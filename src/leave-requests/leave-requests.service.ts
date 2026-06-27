import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database.service';
import { EmployeesService } from '../employees/employees.module';
import { LeaveRequest, LeaveStatus } from '../common/types';
import {
  calcDays,
  isInvalidRange,
  isEntirelyInPast,
} from '../common/date.utils';
import {
  SubmitLeaveRequestDto,
  RejectLeaveRequestDto,
  ListLeaveRequestsQueryDto,
} from './dto';

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly employeesService: EmployeesService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Submit Leave Request
  // ─────────────────────────────────────────────────────────────────────────

  async submit(dto: SubmitLeaveRequestDto, tenantId: string): Promise<LeaveRequest> {
    const { employeeId, leaveType, startDate, endDate, reason } = dto;

    // 1. Validate date range
    if (isInvalidRange(startDate, endDate)) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    // 2. Reject if entirely in the past
    if (isEntirelyInPast(startDate, endDate)) {
      throw new BadRequestException(
        'Leave cannot be submitted for dates entirely in the past',
      );
    }

    // 3. Validate reason rules
    const days = calcDays(startDate, endDate);

    if (leaveType === 'SICK' || leaveType === 'UNPAID') {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException(
          `Reason is required for ${leaveType} leave`,
        );
      }
    }

    if (leaveType === 'SICK' && days > 3) {
      if (!reason || reason.trim().length < 20) {
        throw new BadRequestException(
          'Reason must be at least 20 characters for SICK leave longer than 3 days',
        );
      }
    }

    // 4. Verify employee exists in this tenant
    const employee = await this.employeesService.findById(employeeId, tenantId);

    // 5. Check annual leave balance
    if (leaveType === 'ANNUAL' && employee.annual_leave_balance < days) {
      throw new UnprocessableEntityException(
        `Insufficient annual leave balance. Requested: ${days} day(s), Available: ${employee.annual_leave_balance} day(s)`,
      );
    }

    // 6. Check for overlapping PENDING or APPROVED requests (within a transaction
    //    to guard against concurrent submissions at the same time)
    const leaveRequestId = randomUUID();

    await this.db.transaction(async (client) => {
      // Lock the employee row to prevent concurrent race conditions
      await client.query(
        `SELECT id FROM employees WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [employeeId, tenantId],
      );

      const overlap = await client.query(
        `SELECT id FROM leave_requests
         WHERE employee_id = $1
           AND tenant_id   = $2
           AND status IN ('PENDING', 'APPROVED')
           AND start_date <= $4::date
           AND end_date   >= $3::date`,
        [employeeId, tenantId, startDate, endDate],
      );

      if (overlap.rows.length > 0) {
        throw new ConflictException(
          'Employee already has a PENDING or APPROVED leave request overlapping these dates',
        );
      }

      await client.query(
        `INSERT INTO leave_requests
           (id, tenant_id, employee_id, leave_type, start_date, end_date,
            days_requested, reason, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, 'PENDING', NOW(), NOW())`,
        [leaveRequestId, tenantId, employeeId, leaveType, startDate, endDate, days, reason ?? null],
      );
    });

    const created = await this.db.queryOne<LeaveRequest>(
      `SELECT * FROM leave_requests WHERE id = $1`,
      [leaveRequestId],
    );
    return created!;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Approve Leave Request
  // ─────────────────────────────────────────────────────────────────────────

  async approve(
    requestId: string,
    approverId: string,
    approverRole: string,
    tenantId: string,
    idempotencyKey?: string,
  ): Promise<LeaveRequest> {
    // Assumption: only MANAGER or HR_ADMIN roles may approve.
    if (!['MANAGER', 'HR_ADMIN'].includes(approverRole?.toUpperCase())) {
      throw new ForbiddenException('Only MANAGER or HR_ADMIN can approve leave requests');
    }

    return this.db.transaction(async (client) => {
      // Check idempotency: if we have already processed this key, return existing result
      if (idempotencyKey) {
        const existing = await client.query<LeaveRequest>(
          `SELECT * FROM leave_requests WHERE idempotency_key = $1`,
          [idempotencyKey],
        );
        if (existing.rows.length > 0) {
          this.logger.log(`Idempotent approval replayed for key ${idempotencyKey}`);
          return existing.rows[0];
        }
      }

      // Lock the leave request row to prevent concurrent approvals
      const rows = await client.query<LeaveRequest>(
        `SELECT * FROM leave_requests WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [requestId, tenantId],
      );

      if (rows.rows.length === 0) {
        throw new NotFoundException(`Leave request ${requestId} not found`);
      }

      const request = rows.rows[0];

      if (request.status !== 'PENDING') {
        // Already processed – idempotent return (covers UI retry case)
        if (request.status === 'APPROVED') {
          return request;
        }
        throw new ConflictException(
          `Cannot approve a leave request with status ${request.status}`,
        );
      }

      // Deduct annual leave balance atomically using a conditional UPDATE
      if (request.leave_type === 'ANNUAL') {
        const updated = await client.query(
          `UPDATE employees
              SET annual_leave_balance = annual_leave_balance - $1
            WHERE id = $2
              AND tenant_id = $3
              AND annual_leave_balance >= $1
            RETURNING annual_leave_balance`,
          [request.days_requested, request.employee_id, tenantId],
        );

        if (updated.rows.length === 0) {
          throw new UnprocessableEntityException(
            'Insufficient annual leave balance at time of approval',
          );
        }
      }

      // Update the request status
      const result = await client.query<LeaveRequest>(
        `UPDATE leave_requests
            SET status          = 'APPROVED',
                approved_by     = $1,
                approved_at     = NOW(),
                idempotency_key = COALESCE($2, idempotency_key),
                updated_at      = NOW()
          WHERE id = $3
          RETURNING *`,
        [approverId, idempotencyKey ?? null, requestId],
      );

      return result.rows[0];
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reject Leave Request
  // ─────────────────────────────────────────────────────────────────────────

  async reject(
    requestId: string,
    dto: RejectLeaveRequestDto,
    rejecterId: string,
    tenantId: string,
  ): Promise<LeaveRequest> {
    return this.db.transaction(async (client) => {
      const rows = await client.query<LeaveRequest>(
        `SELECT * FROM leave_requests WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [requestId, tenantId],
      );

      if (rows.rows.length === 0) {
        throw new NotFoundException(`Leave request ${requestId} not found`);
      }

      const request = rows.rows[0];

      if (request.status !== 'PENDING') {
        throw new ConflictException(
          `Cannot reject a leave request with status ${request.status}`,
        );
      }

      const result = await client.query<LeaveRequest>(
        `UPDATE leave_requests
            SET status             = 'REJECTED',
                rejected_by        = $1,
                rejected_at        = NOW(),
                rejection_comment  = $2,
                updated_at         = NOW()
          WHERE id = $3
          RETURNING *`,
        [rejecterId, dto.comment, requestId],
      );

      return result.rows[0];
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // List Leave Requests
  // ─────────────────────────────────────────────────────────────────────────

  async list(query: ListLeaveRequestsQueryDto, tenantId: string): Promise<LeaveRequest[]> {
    const params: any[] = [tenantId];
    const conditions: string[] = ['tenant_id = $1'];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    if (query.employeeId) {
      params.push(query.employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    return this.db.query<LeaveRequest>(
      `SELECT * FROM leave_requests WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get single request (used in tests / future endpoints)
  // ─────────────────────────────────────────────────────────────────────────

  async findById(requestId: string, tenantId: string): Promise<LeaveRequest> {
    const req = await this.db.queryOne<LeaveRequest>(
      `SELECT * FROM leave_requests WHERE id = $1 AND tenant_id = $2`,
      [requestId, tenantId],
    );
    if (!req) {
      throw new NotFoundException(`Leave request ${requestId} not found`);
    }
    return req;
  }
}
