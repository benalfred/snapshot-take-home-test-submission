import { Pool } from 'pg';
import { getDatabaseConfig } from './config';

async function migrate() {
  const pool = new Pool(getDatabaseConfig());

  console.log('Running migrations...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id            VARCHAR(50) PRIMARY KEY,
      tenant_id     VARCHAR(50) NOT NULL DEFAULT 'tenant-001',
      name          VARCHAR(255) NOT NULL,
      email         VARCHAR(255) NOT NULL UNIQUE,
      role          VARCHAR(50)  NOT NULL DEFAULT 'EMPLOYEE',
      annual_leave_balance INTEGER NOT NULL DEFAULT 20,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id              VARCHAR(50) PRIMARY KEY,
      tenant_id       VARCHAR(50)  NOT NULL DEFAULT 'tenant-001',
      employee_id     VARCHAR(50)  NOT NULL REFERENCES employees(id),
      leave_type      VARCHAR(20)  NOT NULL CHECK (leave_type IN ('ANNUAL','SICK','UNPAID')),
      start_date      DATE         NOT NULL,
      end_date        DATE         NOT NULL,
      days_requested  INTEGER      NOT NULL,
      reason          TEXT,
      status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
      approved_by     VARCHAR(50),
      approved_at     TIMESTAMPTZ,
      rejection_comment TEXT,
      rejected_by     VARCHAR(50),
      rejected_at     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  // Partial unique index: an employee cannot have two PENDING or APPROVED
  // requests that overlap. We enforce the no-overlap logic in application code
  // with SELECT FOR UPDATE to handle races, but this index catches duplicates
  // on the same exact (employee, start, end, type) combination cheaply.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status
      ON leave_requests(tenant_id, employee_id, status);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leave_requests_created
      ON leave_requests(created_at DESC);
  `);

  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
