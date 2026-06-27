# PeopleFlow Leave Management API

A RESTful Leave Management API built with **NestJS**, **TypeORM**, and **PostgreSQL**.

This project was implemented as part of the **PeopleFlow Backend Engineer Take-Home Assessment**.

---

# Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- TypeORM

---

# Features

- Employee leave balance management
- Leave request submission
- Leave approval & rejection
- Annual leave balance tracking
- Multi-tenant support
- Transaction-safe leave approvals
- Idempotent approval endpoint
- Soft delete support
- TypeORM migrations
- Database seeding

---

# Project Structure

src
├── common
│   ├── decorators
│   ├── entities
│   ├── filters
│   ├── interceptors
│   ├── interfaces
│   └── utils
│
├── database
│   ├── migrations
│   ├── seeds
│   ├── datasource.ts
│   └── database.module.ts
│
├── employees
│   ├── controllers
│   ├── dto
│   ├── entities
│   ├── repositories
│   ├── services
│   └── employees.module.ts
│
├── leave-requests
│   ├── controllers
│   ├── dto
│   ├── entities
│   ├── repositories
│   ├── services
│   └── leave-requests.module.ts
│
├── app.module.ts
└── main.ts
```

---

# Getting Started

## 1. Install Dependencies

npm install
```

---

## 2. Configure Environment Variables

Copy the example environment file.

```bash
cp .env.example .env
```

The provided `.env.example` contains the required configuration keys.

Update the values in `.env` to match your local PostgreSQL installation if necessary.

---

## 3. Run Database Migrations

```bash
npm run migration:run
```

---

## 4. Seed the Database

```bash
npm run seed
```

This creates sample employees across multiple tenants for testing.

---

## 5. Start the Application

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

The API will be available at:

```
http://localhost:3000
```

---

# API Endpoints

## Employees

### Get Employee Leave Balance

```http
GET /employees/:id/leave-balance
```

### Required Headers

```
x-tenant-id
```

---

## Leave Requests

### Submit Leave Request

```http
POST /leave-requests
```

### Required Headers

```
x-tenant-id
```

---

### Approve Leave Request

```http
POST /leave-requests/:id/approve
```

### Required Headers

```
x-tenant-id
x-approver-id
x-approver-role
```

### Optional Header

```
idempotency-key
```

---

### Reject Leave Request

```http
POST /leave-requests/:id/reject
```

### Required Headers

```
x-tenant-id
x-approver-id
```

---

### List Leave Requests

```http
GET /leave-requests
```

### Query Parameters

| Parameter | Description |
|------------|-------------|
| employeeId | Filter by employee |
| status | Filter by leave request status |

### Required Headers

```
x-tenant-id
```

---

# Database

The project uses **TypeORM Migrations** for schema management.

Entity synchronization is disabled (`synchronize: false`) to align with production best practices.

Database setup consists of:

1. Running migrations
2. Running seed scripts

---

# Assumptions

The following assumptions were made where the assessment requirements were intentionally left ambiguous:

1. **Leave Approval**

    * Leave requests may only be approved by users with the **MANAGER** or **HR_ADMIN** role.

2. **Approver Roles**

    * Approvers are not required to be direct line managers. Any authorized user with the appropriate role (`MANAGER` or `HR_ADMIN`) may approve leave requests.

3. **Leave Duration**

    * Only full-day leave requests are supported. Half-day leave is considered a future enhancement.

4. **Weekends & Public Holidays**

    * Weekends and public holidays are currently counted as leave days. Holiday calendars and working-day calculations are outside the scope of this assessment.

5. **Date Storage & Comparison**

    * Leave dates are stored using PostgreSQL's `DATE` type and compared using UTC-normalized JavaScript `Date` objects to avoid timezone-related inconsistencies.

6. **Concurrent Leave Requests**

    * If two overlapping leave requests are submitted at nearly the same time, database transactions combined with row-level locking ensure that only one request can be successfully processed, preventing inconsistent leave balances or duplicate approvals.

7. **Multi-Step Approval**

    * The current implementation supports a single approval step. A multi-step approval workflow could be introduced by adding approval stages (e.g., Manager → HR → Director) with configurable approval rules while preserving the existing service structure.

8. **Tenant Isolation**

    * Tenant isolation is enforced by requiring every request to include an `x-tenant-id` header and filtering all database queries by `tenantId`. In a production environment, tenant identity should be derived from authenticated JWT claims or an identity provider rather than client-supplied headers.


---

# Design Highlights

The implementation follows several backend engineering best practices:

- Modular NestJS Architecture
- Repository Pattern
- TypeORM Transactions
- Pessimistic Locking
- Idempotent Leave Approval
- DTO Validation using `class-validator`
- Global Exception Handling
- Multi-Tenant Data Isolation
- Database Migrations
- Database Seeding

---

# Future Improvements

Potential enhancements include:

- JWT Authentication
- Role-Based Access Control (RBAC)
- Swagger / OpenAPI Documentation
- Unit Tests
- Integration Tests
- Email Notifications
- Leave Cancellation Workflow
- Approval Audit Trail
- Public Holiday Support
- Half-Day Leave Requests
- Pagination & Sorting

---

# Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the application in development mode |
| `npm run build` | Build the application |
| `npm start` | Run the compiled application |
| `npm run migration:generate` | Generate a new TypeORM migration |
| `npm run migration:run` | Execute pending migrations |
| `npm run seed` | Seed the database with sample data |
---

# Submission Notes

This implementation focuses on:

- Clean architecture
- Maintainability
- Transactional consistency
- Tenant isolation
- Concurrency safety
- Production-ready database management

While authentication and automated testing were outside the primary scope of the assessment, the project has been structured to support these enhancements with minimal changes.

---

Developed as part of the **PeopleFlow Backend Engineer Take-Home Assessment**.# snapshot-take-home-test-submission
