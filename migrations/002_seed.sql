-- Seed data for PeopleFlow
-- Inserts 1 tenant and 4 employees (2 staff, 1 manager, 1 HR admin)

INSERT INTO tenants (id, name) VALUES
  ('tenant-001', 'Acme Corp')
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, tenant_id, name, email, role, annual_leave_balance) VALUES
  ('emp-001', 'tenant-001', 'Alice Johnson',   'alice@acme.com',   'EMPLOYEE',  20),
  ('emp-002', 'tenant-001', 'Bob Smith',        'bob@acme.com',     'EMPLOYEE',  15),
  ('emp-003', 'tenant-001', 'Carol Williams',   'carol@acme.com',   'MANAGER',   20),
  ('emp-004', 'tenant-001', 'David Brown',      'david@acme.com',   'HR_ADMIN',  20)
ON CONFLICT (id) DO NOTHING;
