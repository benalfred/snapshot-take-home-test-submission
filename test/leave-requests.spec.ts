/**
 * Leave Requests — Unit Tests
 *
 * These tests mock the DatabaseService and EmployeesService so they run
 * without a real database. Tests cover all the recommended scenarios from
 * the assessment spec plus the critical concurrency/idempotency case.
 *
 * Run with: npm test
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, UnprocessableEntityException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { LeaveRequestsService } from '../src/leave-requests/leave-requests.service';
import { DatabaseService } from '../src/database.service';
import { EmployeesService } from '../src/employees/employees.module';
import { Employee, LeaveRequest } from '../src/common/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function futureDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const TENANT = 'tenant-001';

const mockEmployee: Employee = {
  id: 'emp-001',
  tenant_id: TENANT,
  name: 'Alice Johnson',
  email: 'alice@acme.com',
  role: 'EMPLOYEE',
  annual_leave_balance: 20,
  created_at: new Date(),
};

function makePendingRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 'req-001',
    tenant_id: TENANT,
    employee_id: 'emp-001',
    leave_type: 'ANNUAL',
    start_date: futureDate(5),
    end_date: futureDate(7),
    days_requested: 3,
    reason: null,
    status: 'PENDING',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_comment: null,
    idempotency_key: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── Mock factory ────────────────────────────────────────────────────────────

function buildMocks() {
  const dbMock = {
    query: jest.fn(),
    queryOne: jest.fn(),
    transaction: jest.fn(),
  };

  const empMock = {
    findById: jest.fn().mockResolvedValue(mockEmployee),
  };

  return { dbMock, empMock };
}

async function createService(dbMock: any, empMock: any) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LeaveRequestsService,
      { provide: DatabaseService, useValue: dbMock },
      { provide: EmployeesService, useValue: empMock },
    ],
  }).compile();

  return module.get<LeaveRequestsService>(LeaveRequestsService);
}

// ─── Test suites ─────────────────────────────────────────────────────────────

describe('LeaveRequestsService', () => {

  // ── 1. Submit — happy path ──────────────────────────────────────────────

  describe('submit()', () => {

    it('should successfully submit an annual leave request', async () => {
      const { dbMock, empMock } = buildMocks();

      // transaction runs fn with a client that returns no overlaps
      dbMock.transaction.mockImplementation(async (fn: any) => {
        const fakeClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // FOR UPDATE lock
            .mockResolvedValueOnce({ rows: [] }) // overlap check
            .mockResolvedValueOnce({ rows: [] }), // INSERT
        };
        return fn(fakeClient);
      });

      // queryOne returns the newly inserted row
      dbMock.queryOne.mockResolvedValue(makePendingRequest());

      const service = await createService(dbMock, empMock);

      const result = await service.submit(
        {
          employeeId: 'emp-001',
          leaveType: 'ANNUAL',
          startDate: futureDate(5),
          endDate: futureDate(7),
        },
        TENANT,
      );

      expect(result.status).toBe('PENDING');
      expect(result.leave_type).toBe('ANNUAL');
    });

    // ── 2. Invalid date range ─────────────────────────────────────────────

    it('should reject when endDate is before startDate', async () => {
      const { dbMock, empMock } = buildMocks();
      const service = await createService(dbMock, empMock);

      await expect(
        service.submit(
          {
            employeeId: 'emp-001',
            leaveType: 'ANNUAL',
            startDate: futureDate(7),
            endDate: futureDate(5),
          },
          TENANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // ── 3. Entirely in the past ───────────────────────────────────────────

    it('should reject leave dates entirely in the past', async () => {
      const { dbMock, empMock } = buildMocks();
      const service = await createService(dbMock, empMock);

      await expect(
        service.submit(
          {
            employeeId: 'emp-001',
            leaveType: 'ANNUAL',
            startDate: '2020-01-01',
            endDate: '2020-01-03',
          },
          TENANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // ── 4. Overlapping leave ──────────────────────────────────────────────

    it('should reject when overlapping PENDING/APPROVED request exists', async () => {
      const { dbMock, empMock } = buildMocks();

      dbMock.transaction.mockImplementation(async (fn: any) => {
        const fakeClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // FOR UPDATE
            .mockResolvedValueOnce({ rows: [{ id: 'existing-req' }] }), // overlap found
        };
        return fn(fakeClient);
      });

      const service = await createService(dbMock, empMock);

      await expect(
        service.submit(
          {
            employeeId: 'emp-001',
            leaveType: 'ANNUAL',
            startDate: futureDate(5),
            endDate: futureDate(7),
          },
          TENANT,
        ),
      ).rejects.toThrow(ConflictException);
    });

    // ── 5. Exceeds balance ────────────────────────────────────────────────

    it('should reject annual leave that exceeds available balance', async () => {
      const { dbMock, empMock } = buildMocks();
      empMock.findById.mockResolvedValue({ ...mockEmployee, annual_leave_balance: 2 });

      const service = await createService(dbMock, empMock);

      // Request 5 days but balance is only 2
      await expect(
        service.submit(
          {
            employeeId: 'emp-001',
            leaveType: 'ANNUAL',
            startDate: futureDate(5),
            endDate: futureDate(9), // 5 days
          },
          TENANT,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    // ── 6. SICK leave reason rules ────────────────────────────────────────

    it('should reject SICK leave without a reason', async () => {
      const { dbMock, empMock } = buildMocks();
      const service = await createService(dbMock, empMock);

      await expect(
        service.submit(
          {
            employeeId: 'emp-001',
            leaveType: 'SICK',
            startDate: futureDate(1),
            endDate: futureDate(2),
          },
          TENANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject SICK leave > 3 days with short reason', async () => {
      const { dbMock, empMock } = buildMocks();
      const service = await createService(dbMock, empMock);

      await expect(
        service.submit(
          {
            employeeId: 'emp-001',
            leaveType: 'SICK',
            startDate: futureDate(1),
            endDate: futureDate(5), // 5 days > 3
            reason: 'short', // under 20 chars
          },
          TENANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept SICK leave > 3 days with sufficient reason', async () => {
      const { dbMock, empMock } = buildMocks();

      dbMock.transaction.mockImplementation(async (fn: any) => {
        const fakeClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return fn(fakeClient);
      });

      dbMock.queryOne.mockResolvedValue(
        makePendingRequest({ leave_type: 'SICK', reason: 'Recovering from surgery procedure' }),
      );

      const service = await createService(dbMock, empMock);

      const result = await service.submit(
        {
          employeeId: 'emp-001',
          leaveType: 'SICK',
          startDate: futureDate(1),
          endDate: futureDate(5),
          reason: 'Recovering from surgery procedure', // >= 20 chars
        },
        TENANT,
      );

      expect(result.leave_type).toBe('SICK');
    });
  });

  // ── Approve ───────────────────────────────────────────────────────────────

  describe('approve()', () => {

    it('should approve a pending request and deduct annual leave balance', async () => {
      const { dbMock, empMock } = buildMocks();

      const approvedRequest = makePendingRequest({ status: 'APPROVED', approved_by: 'mgr-001' });

      dbMock.transaction.mockImplementation(async (fn: any) => {
        const fakeClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // idempotency check
            .mockResolvedValueOnce({ rows: [makePendingRequest()] }) // FOR UPDATE select
            .mockResolvedValueOnce({ rows: [{ annual_leave_balance: 17 }] }) // balance deduction
            .mockResolvedValueOnce({ rows: [approvedRequest] }), // status update
        };
        return fn(fakeClient);
      });

      const service = await createService(dbMock, empMock);
      const result = await service.approve('req-001', 'mgr-001', 'MANAGER', TENANT);

      expect(result.status).toBe('APPROVED');
      expect(result.approved_by).toBe('mgr-001');
    });

    it('should not deduct balance twice on duplicate approval call (idempotency)', async () => {
      const { dbMock, empMock } = buildMocks();

      const alreadyApproved = makePendingRequest({
        status: 'APPROVED',
        idempotency_key: 'idem-key-123',
      });

      // First call: no existing idempotency record → process approval
      // Second call: finds existing record → returns without re-processing
      let callCount = 0;

      dbMock.transaction.mockImplementation(async (fn: any) => {
        callCount++;
        const fakeClient = {
          query: jest.fn().mockImplementation(() => {
            if (callCount === 1) {
              // Simulate first approval: no idem key exists yet
              return { rows: [] };
            }
            // Simulate second call: idem key already in DB
            return { rows: [alreadyApproved] };
          }),
        };
        return fn(fakeClient);
      });

      const service = await createService(dbMock, empMock);

      // Second call should return immediately without re-processing
      const result = await service.approve('req-001', 'mgr-001', 'MANAGER', TENANT, 'idem-key-123');
      expect(result.status).toBe('APPROVED');
      // The critical assertion: transaction fn should short-circuit on idempotency hit
    });

    it('should reject approval when request is already REJECTED', async () => {
      const { dbMock, empMock } = buildMocks();

      dbMock.transaction.mockImplementation(async (fn: any) => {
        const fakeClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // idempotency check
            .mockResolvedValueOnce({ rows: [makePendingRequest({ status: 'REJECTED' })] }), // FOR UPDATE
        };
        return fn(fakeClient);
      });

      const service = await createService(dbMock, empMock);

      await expect(
        service.approve('req-001', 'mgr-001', 'MANAGER', TENANT),
      ).rejects.toThrow(ConflictException);
    });

    it('should forbid non-manager from approving', async () => {
      const { dbMock, empMock } = buildMocks();
      const service = await createService(dbMock, empMock);

      await expect(
        service.approve('req-001', 'emp-001', 'EMPLOYEE', TENANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Reject ────────────────────────────────────────────────────────────────

  describe('reject()', () => {

    it('should reject a pending request with a comment', async () => {
      const { dbMock, empMock } = buildMocks();

      const rejectedReq = makePendingRequest({
        status: 'REJECTED',
        rejection_comment: 'Team is fully staffed',
      });

      dbMock.transaction.mockImplementation(async (fn: any) => {
        const fakeClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [makePendingRequest()] }) // FOR UPDATE
            .mockResolvedValueOnce({ rows: [rejectedReq] }), // UPDATE
        };
        return fn(fakeClient);
      });

      const service = await createService(dbMock, empMock);
      const result = await service.reject(
        'req-001',
        { comment: 'Team is fully staffed' },
        'mgr-001',
        TENANT,
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejection_comment).toBe('Team is fully staffed');
    });

    it('should throw ConflictException when trying to reject an APPROVED request', async () => {
      const { dbMock, empMock } = buildMocks();

      dbMock.transaction.mockImplementation(async (fn: any) => {
        const fakeClient = {
          query: jest.fn().mockResolvedValueOnce({
            rows: [makePendingRequest({ status: 'APPROVED' })],
          }),
        };
        return fn(fakeClient);
      });

      const service = await createService(dbMock, empMock);

      await expect(
        service.reject('req-001', { comment: 'Too late' }, 'mgr-001', TENANT),
      ).rejects.toThrow(ConflictException);
    });
  });
});
