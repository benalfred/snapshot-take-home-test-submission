# PeopleFlow — Leave Request & Approval Module

A NestJS + PostgreSQL implementation of a multi-tenant HR leave management API.

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure database

```bash
cp .env.example .env
# Edit .env and set your DATABASE_URL:
# DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/peopleflow
```

Create the database if it doesn't exist:
```bash
createdb peopleflow
```

### 3. Run migrations and seed

```bash
npm run migrate
```

This runs both `001_schema.sql` (tables + indexes) and `002_seed.sql` (1 tenant, 4 employees).

### 4. Start the server

```bash
npm run dev        # development with hot reload
# or
npm run build && npm start  # production build
```

The API will be available at `http://localhost:3000`.

### 5. Run tests

```bash
npm test
```

---

## Seeded Data

| Employee ID | Name            | Role      | Annual Leave Balance |
|-------------|-----------------|-----------|----------------------|
| emp-001     | Alice Johnson   | EMPLOYEE  | 20 days              |
| emp-002     | Bob Smith       | EMPLOYEE  | 15 days              |
| emp-003     | Carol Williams  | MANAGER   | 20 days              |
| emp-004     | David Brown     | HR_ADMIN  | 20 days              |

Tenant ID: `tenant-001`

---

## API Reference

All endpoints accept the header `X-Tenant-Id: tenant-001` (defaults to `tenant-001` if omitted).

### Submit Leave Request
```
POST /leave-requests
Content-Type: application/json
X-Tenant-Id: tenant-001

{
  "employeeId": "emp-001",
  "leaveType": "ANNUAL",
  "startDate": "2025-08-01",
  "endDate": "2025-08-05",
  "reason": "Family holiday"
}
```

### Approve Leave Request
```
POST /leave-requests/:id/approve
X-Approver-Id: emp-003
X-Approver-Role: MANAGER
X-Idempotency-Key: unique-key-per-click   (optional, for safe retries)
```

### Reject Leave Request
```
POST /leave-requests/:id/reject
Content-Type: application/json
X-Approver-Id: emp-003

{
  "comment": "Team is at full capacity during this period"
}
```

### List Leave Requests
```
GET /leave-requests?status=PENDING&employeeId=emp-001
```

### Get Leave Balance
```
GET /employees/emp-001/leave-balance
```

---

## cURL Examples

```bash
# Submit annual leave
curl -X POST http://localhost:3000/leave-requests \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant-001" \
  -d '{"employeeId":"emp-001","leaveType":"ANNUAL","startDate":"2025-08-01","endDate":"2025-08-05"}'

# Check balance
curl http://localhost:3000/employees/emp-001/leave-balance \
  -H "X-Tenant-Id: tenant-001"

# Approve (replace REQUEST_ID)
curl -X POST http://localhost:3000/leave-requests/REQUEST_ID/approve \
  -H "X-Approver-Id: emp-003" \
  -H "X-Approver-Role: MANAGER" \
  -H "X-Idempotency-Key: approve-req-$(date +%s)"

# Reject
curl -X POST http://localhost:3000/leave-requests/REQUEST_ID/reject \
  -H "Content-Type: application/json" \
  -H "X-Approver-Id: emp-003" \
  -d '{"comment":"Team is fully staffed during this period"}'

# List all pending requests
curl "http://localhost:3000/leave-requests?status=PENDING"
```

---

## Design Decisions & Assumptions

### Tenant Isolation
Tenant ID is passed via `X-Tenant-Id` header and is applied as a `WHERE tenant_id = ?` clause on every query. In production this would be derived from a JWT token, but a full auth system was explicitly out of scope.

### Ambiguous Requirements — My Answers

**1. Who can approve leave?**  
Only employees with role `MANAGER` or `HR_ADMIN`. Role is passed via `X-Approver-Role` header. In production this would be derived from the authenticated user's role.

**2. Are approvers required to be managers?**  
Yes — `MANAGER` or `HR_ADMIN`. An `EMPLOYEE` attempting to approve receives `403 Forbidden`.

**3. Are half-days supported?**  
No — only full calendar days. The `days_requested` is computed as `(endDate - startDate) + 1`. Half-days are documented as a future extension.

**4. Do weekends and public holidays count?**  
Yes — this implementation counts all calendar days (including weekends). No public holiday calendar is integrated. This is a documented limitation; production systems would want a `WorkCalendar` table per tenant.

**5. How are dates stored and compared?**  
Leave dates are stored as `DATE` columns in PostgreSQL (no time component). All timestamps use `TIMESTAMPTZ` (UTC). Date comparison uses PostgreSQL date arithmetic, avoiding timezone edge cases.

**6. What happens if two overlapping requests are submitted concurrently?**  
The overlap check and insert are wrapped in a transaction with a `SELECT … FOR UPDATE` lock on the employee row. The second concurrent submission blocks until the first commits, then sees the first request and throws `409 Conflict`.

**7. How would you extend for a multi-step approval chain?**  
Introduce an `approval_steps` table: `(id, leave_request_id, step_order, approver_role, status, approved_by, approved_at)`. The leave request status advances to `APPROVED` only when all required steps are complete. Each step would be triggered by the previous step's approval event.

**8. How would you enforce tenant isolation in production?**  
JWT claims would carry `tenantId`. A NestJS guard extracts and validates it. Row-level security (RLS) in PostgreSQL provides a second enforcement layer. All queries include `tenant_id = ?` — there is no cross-tenant join path.

### Balance Deduction
Balance is deducted synchronously inside the approve transaction using a conditional atomic UPDATE (`WHERE balance >= days`). This prevents double-deduction without application-level locking.

### Idempotency
The approve endpoint accepts an optional `X-Idempotency-Key` header. The key is stored on the leave request row with a unique database index. A repeated call with the same key returns the already-approved request without re-processing.

### Error Handling
Stack traces are never returned to clients. The `AllExceptionsFilter` catches all unhandled exceptions, logs them server-side, and returns a structured `{ statusCode, message, path, timestamp }` response.

---

## Limitations (Not Implemented)

- Authentication / JWT
- Public holiday calendar integration
- Email notifications
- Multi-step approval chains
- Full HR override flow
- Cancel approved leave
- Frontend
