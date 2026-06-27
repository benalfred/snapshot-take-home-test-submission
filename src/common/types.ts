export type LeaveType = 'ANNUAL' | 'SICK' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type EmployeeRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN';

export interface Employee {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: EmployeeRole;
  annual_leave_balance: number;
  created_at: Date;
}

export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string; // ISO date string YYYY-MM-DD
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: Date | null;
  rejected_by: string | null;
  rejected_at: Date | null;
  rejection_comment: string | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}
