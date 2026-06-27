# DEBUGGING.md

# Overview

This document explains the architectural decisions made while implementing the Leave Management API and provides responses to the debugging exercise included in the assessment.

---

# Architecture

The project follows NestJS's modular architecture, separating business features from shared infrastructure.

The primary modules are:

* **Employees** – Employee management and leave balance operations.
* **Leave Requests** – Leave submission, approval, rejection, and listing.
* **Database** – TypeORM configuration, migrations, and seed scripts.
* **Common** – Shared decorators, entities, interceptors, exception filters, utilities, interfaces, and reusable components.

The feature modules (**Employees** and **Leave Requests**) are organized using a layered architecture consisting of:

* Controller
* Service
* Repository
* DTOs
* Entities

The **Database** and **Common** modules provide infrastructure and shared functionality used across the application.

This separation of concerns improves maintainability, promotes code reuse, and keeps business logic isolated from framework concerns.

---

# Repository Pattern

Business logic does not communicate directly with TypeORM repositories.

Repositories encapsulate all database operations, allowing services to focus purely on business rules.

Advantages include:

* Better separation of concerns
* Cleaner service layer
* Easier unit testing
* Centralized data access

---

# Transactions

Approving leave modifies multiple records:

1. Employee annual leave balance
2. Leave request status

These operations must either both succeed or both fail.

For this reason, leave approval executes inside a single database transaction.

If any operation fails, the transaction is rolled back automatically, preventing inconsistent data.

---

# Pessimistic Locking

Concurrent approval requests can result in duplicate leave deductions.

To prevent race conditions, approval acquires a pessimistic write lock on:

* Leave Request
* Employee

This guarantees that only one approval transaction can modify these records at a time.

---

# Idempotency

The UI may retry requests due to network failures or timeouts.

Approving the same leave request multiple times should never deduct leave multiple times.

The API accepts an optional **Idempotency-Key** header, which is stored against the leave request.

If the request has already been processed successfully, the existing approval is returned instead of processing it again.

---

# Multi-tenancy

Every record belongs to a tenant.

Tenant isolation is achieved through the `x-tenant-id` request header.

Every database query filters using `tenantId`.

Unique constraints are also scoped per tenant.

Example:

Tenant A

```
EMP001
```

Tenant B

```
EMP001
```

Both employee codes are valid because uniqueness is enforced per tenant.

---

# Leave Validation

The following business rules are implemented:

* End date must not be before the start date.
* Leave entirely in the past cannot be submitted.
* Sick and unpaid leave require a reason.
* Sick leave longer than three days requires a detailed explanation.
* Annual leave cannot exceed the employee's available balance.
* Overlapping pending or approved leave requests are rejected.

---

# Soft Delete

All entities inherit from a shared base entity containing:

* id
* createdAt
* updatedAt
* deletedAt

Soft delete was chosen to preserve historical records and support future auditing requirements.

---

# Database

Database schema changes are managed using TypeORM migrations.

Seed scripts populate sample employee records across multiple tenants for testing.

---

# Error Handling

A global exception filter standardizes all API error responses.

This prevents leaking internal stack traces while ensuring clients receive consistent error payloads.

DTO validation rejects malformed requests before business logic is executed.

---

# Response Formatting

A global response interceptor standardizes all successful API responses.

Instead of manually wrapping responses inside controllers, every successful request is automatically transformed into a consistent structure containing:

* success
* statusCode
* data
* path
* timestamp

This keeps controllers focused on business logic while maintaining a consistent API contract.

---

# Debugging Exercise – Duplicate Leave Balance Deduction

## 1. What went wrong?

The approval flow was not executed atomically.

When the client retried the approval request after a timeout, two approval requests reached the server almost simultaneously.

Both requests read the leave request while its status was still `PENDING` and proceeded to deduct the employee's leave balance independently.

---

## 2. Why was the balance deducted twice?

The original implementation performed multiple database operations without wrapping them inside a transaction or locking the affected rows.

The sequence looked like this:

1. Request A reads the leave request (`PENDING`).
2. Request B reads the same leave request (`PENDING`).
3. Request A deducts 5 days.
4. Request B deducts another 5 days.
5. Both requests update the leave request to `APPROVED`.

Because both requests operated concurrently on stale data, the employee's leave balance was deducted twice.

---

## 3. Corrected Approach

The implemented solution addresses this by:

* Executing the approval inside a database transaction.
* Acquiring pessimistic write locks on both the leave request and employee records.
* Re-checking the leave request status after obtaining the lock.
* Supporting idempotent approvals through an optional `Idempotency-Key`.

Pseudo-code:

```text
Begin Transaction

Lock Leave Request

If status != PENDING
    Return existing approval or throw Conflict

Lock Employee

Validate leave balance

Deduct annual leave balance

Update leave request to APPROVED

Commit Transaction
```

---

## 4. Why the Fix Works

The transaction guarantees that either every operation succeeds or none of them do.

Pessimistic locking ensures only one approval request can modify the leave request and employee records at a time.

If another approval request arrives while the first transaction is running, it waits for the lock.

Once the first transaction commits, subsequent requests observe that the leave request has already been approved and therefore do not deduct the leave balance again.

---

## 5. Preventing Future Recurrence

In addition to transactions and row-level locking, I would implement the following safeguards:

* Continue supporting an **Idempotency-Key** for safely handling client retries.
* Publish approval events using the **Transactional Outbox Pattern** so events are persisted and published exactly once.
* Store unique event identifiers to prevent downstream consumers from processing duplicate events.
* Add integration tests that simulate concurrent approval requests.
* Monitor duplicate approval attempts using structured logging and application metrics.

Together, these measures protect both the database and downstream systems from duplicate processing.

---

# Assumptions

* Authentication and authorization are outside the scope of this assessment.
* User identity is represented through request headers.
* Tenant information is supplied through request headers.
* Managers and HR administrators are trusted approvers.
* Leave approval is a manual workflow.

---

# Future Enhancements

* JWT Authentication
* Role-Based Access Control (RBAC)
* Swagger / OpenAPI Documentation
* Unit Tests
* Integration Tests
* Transactional Outbox Pattern
* Email Notifications
* Leave Cancellation
* Holiday Calendar Support
* Public Holiday Exclusion
* Half-day Leave Support
* Audit Trail
