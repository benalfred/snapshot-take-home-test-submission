# DEBUGGING.md — Section 2: Duplicate Leave Balance Deduction

## 1. What went wrong

The `approveLeaveRequest` function had a classic **check-then-act** race condition with no database transaction or row-level locking. Two concurrent calls for the same `requestId` both:

1. Read the request — both see `status = 'PENDING'`
2. Read the employee — both see `annualLeaveBalance = 10`
3. Both pass the balance check (`10 >= 5`)
4. Both write `annualLeaveBalance = 10 - 5 = 5`
5. Both update the request status to `'APPROVED'`

Because the reads and writes happened outside any transaction, the second write simply overwrote the first — it did not decrement from 5 but from the stale 10, landing at 5 again. Then both status updates succeeded because neither saw the other's committed change. The net result was the balance dropped from 10 to 5 twice (total 0) or — depending on timing — the balance only dropped once but the status was double-written. In the reported incident the logs show it ran twice in 200ms, which is consistent with a UI retry on timeout.

## 2. Why the balance was deducted twice

The root cause is three separate database round trips with no isolation:

```
read request  ──> read employee  ──> write employee  ──> write request
     ↑ both goroutines here                ↑ both goroutines here
```

PostgreSQL's default `READ COMMITTED` isolation does not protect against this pattern. The second connection reads the committed pre-update balance because the first connection has not committed yet.

## 3. Corrected code

```typescript
async approveLeaveRequest(requestId: string, approverId: string, idempotencyKey?: string) {
  return this.db.transaction(async (client) => {

    // ① Idempotency fast-path — if we already processed this key, return early
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT * FROM leave_requests WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (existing.rows.length > 0) return existing.rows[0];
    }

    // ② Lock the row — any concurrent call blocks here until this transaction commits
    const rows = await client.query(
      `SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE`,
      [requestId],
    );
    if (rows.rows.length === 0) throw new NotFoundError('Leave request not found');
    const request = rows.rows[0];

    // ③ Status guard — recheck inside the lock; returns already-approved safely
    if (request.status === 'APPROVED') return request;
    if (request.status !== 'PENDING') throw new ConflictError('Leave request is not pending');

    // ④ Atomic balance deduction with a conditional UPDATE — fails if balance is
    //    now insufficient, and NEVER runs twice for the same request because
    //    step ③ already returned or threw.
    if (request.leaveType === 'ANNUAL') {
      const updated = await client.query(
        `UPDATE employees
            SET annual_leave_balance = annual_leave_balance - $1
          WHERE id = $2
            AND annual_leave_balance >= $1
          RETURNING annual_leave_balance`,
        [request.daysRequested, request.employeeId],
      );
      if (updated.rows.length === 0) {
        throw new UnprocessableError('Insufficient leave balance');
      }
    }

    // ⑤ Stamp status + idempotency key atomically
    const result = await client.query(
      `UPDATE leave_requests
          SET status          = 'APPROVED',
              approved_by     = $1,
              approved_at     = NOW(),
              idempotency_key = COALESCE($2, idempotency_key)
        WHERE id = $3
        RETURNING *`,
      [approverId, idempotencyKey ?? null, requestId],
    );

    await this.eventBus.publish('leave.approved', { requestId, employeeId: request.employeeId });

    return result.rows[0];
  });
}
```

## 4. Why the fix works

| Mechanism | What it prevents |
|---|---|
| `BEGIN … COMMIT` transaction | All reads and writes are atomic. If any step fails, the whole thing rolls back. |
| `SELECT … FOR UPDATE` | The first caller acquires a row lock. The second caller blocks until the first commits. When it resumes, it sees `status = 'APPROVED'` and returns early (step ③). |
| Atomic conditional `UPDATE … WHERE balance >= days` | Balance deduction and the existence check are one statement. If balance is now 0, it returns 0 rows and throws. No double-deduction is possible. |
| Idempotency key | If the UI retries with the same `X-Idempotency-Key`, we detect and skip re-processing before even acquiring the row lock. |

## 5. What I would add to prevent recurrence

1. **Unique DB constraint on `idempotency_key`** — already added to the schema (`CREATE UNIQUE INDEX`). Even if application logic fails, the DB prevents a duplicate.
2. **Integration test for concurrent approval** — spin up two promises calling `approve` simultaneously, assert balance is deducted exactly once.
3. **Metrics / alerting** — alert on `ConflictException` spikes from the approval endpoint.
4. **Outbox pattern for event publishing** — currently the event is published after the commit. If the process crashes between `COMMIT` and `publish`, the event is lost. An outbox table written inside the same transaction gives at-least-once delivery without duplicates.
