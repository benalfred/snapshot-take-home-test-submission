-- PeopleFlow Leave Module Schema
-- Run with: npm run migrate

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE', -- EMPLOYEE | MANAGER | HR_ADMIN
  annual_leave_balance INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
  employee_id VARCHAR(36) NOT NULL REFERENCES employees(id),
  leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('ANNUAL', 'SICK', 'UNPAID')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by VARCHAR(36),
  approved_at TIMESTAMPTZ,
  rejected_by VARCHAR(36),
  rejected_at TIMESTAMPTZ,
  rejection_comment TEXT,
  idempotency_key VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Unique index to prevent duplicate approvals (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_requests_idempotency 
  ON leave_requests(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Index for overlap detection queries
CREATE INDEX IF NOT EXISTS idx_leave_requests_overlap 
  ON leave_requests(employee_id, status, start_date, end_date);

-- Index for filtering/listing
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant 
  ON leave_requests(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee 
  ON leave_requests(employee_id, created_at DESC);
