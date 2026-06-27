# AI_REFLECTION.md — Section 5: AI Usage

## 1. Which AI tools did you use?

Claude (Anthropic) was used as the primary implementation assistant for this assessment.

## 2. How did you use them?

I provided the full assessment brief and asked Claude to scaffold the project — directory structure, schema, NestJS modules, service logic, controller, tests, and documentation files. Claude generated the majority of the code in one guided session.

## 3. Which generated code did you modify and why?

- **Database module wiring:** The initial draft placed `DatabaseService` directly in `AppModule` without a `@Global()` module, causing injection errors in feature modules. I corrected this by introducing a separate `DatabaseModule` marked `@Global()`.
- **Transaction client typing:** The initial `transaction()` helper typed the callback client as `any`. I tightened it to `PoolClient` from the `pg` package to preserve type safety.
- **Idempotency short-circuit:** Claude initially returned early from the idempotency check but still ran the `FOR UPDATE` query below it. I restructured the transaction callback so a confirmed idempotency hit returns immediately without acquiring the lock.
- **Test mock chain ordering:** Some mock `.mockResolvedValueOnce` chains were in the wrong order relative to the actual query sequence. I traced through the service code and corrected the ordering.

## 4. What AI suggestions did you reject and why?

- **TypeORM / Prisma ORM:** Claude suggested using an ORM for the persistence layer. I rejected this in favour of raw `pg` queries inside a lightweight `DatabaseService`. For an assessment, raw SQL makes the concurrency logic (transactions, `FOR UPDATE`, conditional UPDATEs) explicit and easier to reason about — an ORM would have hidden the important mechanics.
- **Separate `AuditLogService`:** Claude proposed a full audit log implementation with its own module and entity. I documented the design instead (DESIGN_NOTES.md §3) and kept the implementation scope focused on what was required.
- **Passport/JWT auth guard:** Suggested for protecting the approve endpoint. I rejected it — the spec explicitly says not to implement a full auth system — and used simple header-based role passing instead, documented in README assumptions.

## 5. What technical decisions were entirely yours?

- Using `SELECT … FOR UPDATE` row-level locking rather than application-level mutex or optimistic locking. This was a deliberate choice based on understanding PostgreSQL isolation semantics.
- The conditional `UPDATE … WHERE balance >= days RETURNING *` pattern for atomic balance deduction — checking and decrementing in a single statement to eliminate the TOCTOU window.
- The decision to keep `idempotency_key` stored on the `leave_requests` row rather than a separate idempotency table, to reduce join complexity for a single-resource operation.
- Choosing `TIMESTAMPTZ` (timezone-aware) for all timestamps and `DATE` for leave dates, and storing/comparing dates as UTC calendar dates.
- The `@Global()` `DatabaseModule` pattern rather than importing `DatabaseService` in every feature module.

## 6. What part of the work would I be most comfortable defending in a technical interview?

The **concurrency and idempotency design** in the approve flow. I can walk through exactly why `SELECT … FOR UPDATE` prevents the race condition, why the conditional `UPDATE … WHERE balance >= N` eliminates the check-then-act window, and why storing the idempotency key on the resource row (with a unique index) gives database-level enforcement even if application logic has a bug. I can also explain the tradeoffs of this approach versus optimistic locking, versus a saga pattern, and versus an outbox for the downstream event.
