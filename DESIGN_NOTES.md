# DESIGN_NOTES.md — Sections 3 & 4

---

## Section 3: System Design Questions

### 1. Scaling Leave Submissions (Friday 4pm spike)

The submission endpoint is CPU-light but DB-write-heavy. The main bottleneck is the overlap-check + insert transaction hitting one primary PostgreSQL node.

**What I would do:**
- Horizontal scale the API tier behind a load balancer (stateless NestJS pods are already safe for this).
- Add a **read replica** so the overlap SELECT query can hit the replica while the final insert/lock goes to primary.
- If 500 companies each have ~500 employees and 10% submit simultaneously, that is ~25,000 requests over a 15-minute window — roughly 28 req/s. This is comfortably handled by a single well-tuned Postgres instance, so queue-based offloading is not yet needed.
- If the spike grows 10x, introduce a **rate limiter per tenant** (e.g., token bucket in Redis) so no single company monopolises the DB.

**What I would measure:** p95/p99 submission latency, DB connection pool saturation, overlap-check query time (add `EXPLAIN ANALYZE` on the index scan), error rate by tenant.

---

### 2. Duplicate Event Processing

Use **idempotency keys on the consumer side**:

1. Include a stable `eventId` (e.g., UUID tied to the leave request + action) in every published event.
2. Each consumer (payroll, notifications) maintains a `processed_events(event_id PRIMARY KEY)` table.
3. On receipt: `INSERT INTO processed_events … ON CONFLICT DO NOTHING` inside the same transaction as the business effect. If the insert is a no-op the event was already handled.

This gives exactly-once semantics without coordinating producers and works regardless of how many times the broker re-delivers.

---

### 3. Audit Logging

Write audit records **inside the same transaction** as the state change, to a dedicated `leave_request_audit_log` table:

```sql
(id, leave_request_id, actor_id, action, old_status, new_status, metadata jsonb, created_at)
```

This is fast (one extra INSERT per state change, same round-trip) and guarantees the log is never out of sync with the main table. The table is append-only; application code never updates or deletes rows. For compliance exports, a separate read model or periodic dump can be generated without touching the hot path.

If audit volume becomes very large, partition `leave_request_audit_log` by month and archive old partitions to cold storage (S3 Glacier / BigQuery).

---

### 4. Sync vs Async Balance Deduction

**Synchronous (my choice for this product):** deduct inside the approve transaction.

*Why:* HR/payroll-adjacent products require strong consistency. If balance is deducted asynchronously, the employee and manager both see "approved" but the balance might still show 15 days for a few seconds, enabling a second approval to pass the balance check before the worker runs. This is a data-integrity risk that is hard to explain to compliance.

*Tradeoff:* The approve endpoint is slightly slower (one extra UPDATE in the transaction). That is acceptable — approvals are low-frequency human actions, not high-throughput.

Async deduction would make sense if balance calculation were expensive (e.g., involving complex payroll rules across multiple services). In that case an optimistic reservation + async reconciliation pattern works, but requires compensating transactions on failure.

---

### 5. Monolith vs Microservice

**Keep it in the monolith now.** Extract when:
- The leave module has a team of ≥2 engineers who are blocked by shared deployments.
- Leave logic needs a different scaling profile than the rest of the HR platform (e.g., it gets 100x more traffic).
- A regulatory boundary requires separate data residency.

**Risks of splitting early:**
- Distributed transactions: approving leave and updating payroll ledger become a two-phase commit problem.
- Network latency on every cross-service call adds up during approval chains.
- Operational overhead (separate CI/CD, separate DB, schema versioning across service boundaries) before the team is large enough to justify it.

---

## Section 4: Product & Engineering Judgment

### Scenario A — The Quick Win ("Just flip the status")

**Risks of flipping status to PENDING:**
- Balance is not restored → employee can re-submit but their balance is wrong.
- No audit trail of the cancellation or the original approval.
- Payroll integration (if any) already consumed the approval event.
- The approved request reappears in the approver's queue with no explanation.
- Sets a precedent of "we can undo anything" without enforcement.

**What I would recommend:**
Build a minimal but safe `CANCELLED` status with balance restoration in a single transaction. Estimated: 1 day, not 2 weeks (the 2-week estimate includes all edge cases, but a scoped demo version can be much smaller).

**What I would ship for the demo:**
A `POST /leave-requests/:id/cancel` endpoint that:
1. Only works while the request is still `APPROVED` and the leave has not started yet.
2. Restores balance atomically in a transaction.
3. Writes a single audit log row.
4. Returns a clear `CANCELLED` status.

**What I would refuse to ship:**
Flipping status to `PENDING` without balance restoration. That corrupts data in a way that is hard to detect and harder to fix at scale.

---

### Scenario B — Consistency vs Performance (80ms DB query vs 5ms Redis cache)

**Tradeoffs:**

| | DB direct | Redis cache |
|---|---|---|
| Accuracy | Always correct | Up to 60s stale |
| Latency | +80ms per page load | +5ms |
| Operational complexity | None extra | Cache invalidation logic, Redis cluster |
| Risk in HR/payroll context | Low | Medium — stale balance could confuse employees |

**My recommendation: DB direct, with a targeted optimisation.**

For a payroll-adjacent product, a manager approving leave while the employee sees a stale balance is a trust and compliance issue. 80ms is noticeable but not unacceptable for a page that opens once per session.

Before introducing a cache, I would first check if the 80ms can be brought down: ensure `annual_leave_balance` is indexed, consider a `SELECT` that only fetches that one column, or add a materialized summary column.

If caching is ultimately required, I would use **write-through caching** (invalidate/update Redis immediately on every balance change inside the approval transaction) rather than TTL-based expiry. This gives near-cache performance with near-DB consistency.
