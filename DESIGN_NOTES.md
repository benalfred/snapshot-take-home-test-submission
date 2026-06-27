# DESIGN_NOTES.md

# Design Notes

This document outlines the architectural decisions made during the implementation of the Leave Management API and provides responses to the design questions included in the assessment.

---

# 1. Scaling Leave Submissions

If the application needed to handle millions of leave requests per day, I would introduce asynchronous processing using a message broker such as RabbitMQ or Kafka.

The API would remain responsible for validating and persisting requests, after which an event would be published for downstream processing. This approach improves throughput and allows expensive operations such as notifications and audit logging to be handled independently.

Additional improvements would include:

- Horizontal scaling of API instances
- Database indexing and query optimization
- Redis caching for frequently accessed employee data
- Archiving or partitioning historical leave records

---

# 2. Preventing Duplicate Event Processing

Distributed systems must assume duplicate events can occur.

To prevent processing the same operation multiple times, I would implement idempotency by assigning each event a unique identifier. Consumers would store processed identifiers and ignore duplicate events.

For this implementation, the leave approval endpoint already supports an optional **Idempotency-Key**. Combined with transactional updates, this prevents duplicate approvals from deducting an employee's leave balance multiple times.

---

# 3. Audit Logging

Rather than storing audit information inside the business tables, I would implement a dedicated audit log.

Each audit record would contain:

- User performing the action
- Tenant identifier
- Action performed
- Timestamp
- Previous values
- Updated values

In a larger system, audit events could be published asynchronously to avoid impacting API response times while maintaining a complete history of changes.

---

# 4. Synchronous vs Asynchronous Leave Balance Deduction

I chose synchronous balance deduction during leave approval.

Approving a leave request and deducting an employee's annual leave balance are part of the same business transaction and should either both succeed or both fail.

Wrapping both operations inside a single database transaction guarantees data consistency and prevents partial updates.

---

# 5. Monolith vs Microservices

For the scope of this assessment, I chose a modular monolith.

NestJS modules provide clear separation of concerns while keeping deployment and development straightforward.

As the application grows, domains such as Employees, Leave Management, Notifications, and Audit Logging could be extracted into independent microservices that communicate through events.

---

# Product & Engineering Scenarios

## Scenario A – Quick Win

If product requested half-day leave support before an important customer demo, I would extend the leave request model with a duration field (FULL_DAY, HALF_DAY_AM, HALF_DAY_PM) and allow daysRequested to support fractional values (e.g., 0.5). Validation would ensure that half-day leave can only be requested for a single date and that overlapping requests are prevented (e.g., two HALF_DAY_AM requests on the same date). The approval workflow would remain unchanged, with leave balance deductions adjusted to account for fractional days.

This delivers value quickly while minimizing risk and preserving the existing approval workflow.

---

## Scenario B – Consistency vs Performance

For leave approvals, I prioritize consistency over performance.

An incorrect leave balance can lead to business and HR issues, whereas a slightly slower approval request is generally acceptable.

This is why I implemented transactions together with pessimistic locking to ensure concurrent approvals cannot corrupt employee leave balances.

---

# Summary

The implementation focuses on correctness, maintainability, and production-ready backend practices.

Key design decisions include:

- NestJS Modular Architecture
- Repository Pattern
- TypeORM with PostgreSQL
- Database Migrations
- Transaction Management
- Pessimistic Locking
- Idempotent Leave Approval
- Multi-Tenant Data Isolation
- Soft Delete Support
- DTO Validation
- Global Exception Handling