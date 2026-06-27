import {LeaveRequestRepository} from "./repositories/leave-request.repository";
import {EmployeeRepository} from "../employees/repositories/employee.repository";
import {EmployeesService} from "../employees/employees.service";
import {DataSource} from "typeorm";
import {LeaveRequest} from "./entities/leave-request.entity";
import {
  BadRequestException,
  ConflictException, ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import {calculateLeaveDays} from "../common/utils/date.utils";
import {LeaveType} from "./enums/leave-type.enum";
import {Employee} from "../employees/entities/employee.entity";
import {LeaveStatus} from "./enums/leave-status.enum";
import {CreateLeaveRequestDto} from "./dto/create-leave-request.dto";
import {ApproverRole} from "./enums/approver-role.enum";
import {RejectLeaveRequestDto} from "./dto/reject-leave-request.dto";
import {ListLeaveRequestsDto} from "./dto/list-leave-request.dto";

@Injectable()
export class LeaveRequestsService {
  constructor(
      private readonly leaveRequestRepository: LeaveRequestRepository,
      private readonly dataSource: DataSource,
  ) {}

  async submitLeaveRequest(
      dto: CreateLeaveRequestDto,
      tenantId: string,
  ): Promise<LeaveRequest> {
    const {
      employeeId,
      leaveType,
      startDate,
      endDate,
      reason,
    } = dto;

    const start = new Date(startDate);
    const end = new Date(endDate);


    if (end < start) {
      throw new BadRequestException(
          'End date must be on or after start date.',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (end < today) {
      throw new BadRequestException(
          'Leave cannot be submitted for dates entirely in the past.',
      );
    }

    const daysRequested = calculateLeaveDays(start, end);


    if (
        leaveType === LeaveType.SICK ||
        leaveType === LeaveType.UNPAID
    ) {
      if (!reason?.trim()) {
        throw new BadRequestException(
            `Reason is required for ${leaveType} leave.`,
        );
      }
    }

    if (
        leaveType === LeaveType.SICK &&
        daysRequested > 3 &&
        reason!.trim().length < 20
    ) {
      throw new BadRequestException(
          'SICK leave longer than 3 days requires a reason of at least 20 characters.',
      );
    }

    return this.dataSource.transaction(async (manager) => {

      const employee = await manager.findOne(Employee, {
        where: {
          id: employeeId,
          tenantId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!employee) {
        throw new NotFoundException(
            'Employee not found.',
        );
      }


      if (
          leaveType === LeaveType.ANNUAL &&
          employee.annualLeaveBalance < daysRequested
      ) {
        throw new UnprocessableEntityException(
            `Insufficient leave balance. Available: ${employee.annualLeaveBalance}, Requested: ${daysRequested}`,
        );
      }


      const overlap = await manager
          .createQueryBuilder(
              LeaveRequest,
              'leaveRequest',
          )
          .where(
              'leaveRequest.employeeId = :employeeId',
              { employeeId },
          )
          .andWhere(
              'leaveRequest.tenantId = :tenantId',
              { tenantId },
          )
          .andWhere(
              'leaveRequest.status IN (:...statuses)',
              {
                statuses: [
                  LeaveStatus.PENDING,
                  LeaveStatus.APPROVED,
                ],
              },
          )
          .andWhere(
              ':startDate <= leaveRequest.endDate',
              {
                startDate: start,
              },
          )
          .andWhere(
              ':endDate >= leaveRequest.startDate',
              {
                endDate: end,
              },
          )
          .getOne();

      if (overlap) {
        throw new ConflictException(
            'Employee already has an overlapping leave request.',
        );
      }


      const leaveRequest = manager.create(
          LeaveRequest,
          {
            tenantId,
            employeeId,
            leaveType,
            startDate: start,
            endDate: end,
            daysRequested,
            reason,
            status: LeaveStatus.PENDING,
          },
      );

      return manager.save(leaveRequest);
    });
  }


  async approveLeaveRequest(
      requestId: string,
      approverId: string,
      approverRole: ApproverRole,
      tenantId: string,
      idempotencyKey?: string,
  ): Promise<LeaveRequest> {
    if (
        ![
          ApproverRole.MANAGER,
          ApproverRole.HR_ADMIN,
        ].includes(approverRole)
    ) {
      throw new ForbiddenException(
          'Only managers or HR admins can approve leave requests.',
      );
    }

    return this.dataSource.transaction(async (manager) => {

      if (idempotencyKey) {
        const processedRequest = await manager.findOne(LeaveRequest, {
          where: {
            idempotencyKey,
            tenantId,
          },
        });

        if (processedRequest) {
          return processedRequest;
        }
      }

      const leaveRequest = await manager.findOne(LeaveRequest, {
        where: {
          id: requestId,
          tenantId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!leaveRequest) {
        throw new NotFoundException(
            'Leave request not found.',
        );
      }


      if (leaveRequest.status === LeaveStatus.APPROVED) {
        return leaveRequest;
      }

      if (leaveRequest.status !== LeaveStatus.PENDING) {
        throw new ConflictException(
            `Cannot approve a ${leaveRequest.status} leave request.`,
        );
      }


      if (leaveRequest.leaveType === LeaveType.ANNUAL) {
        const employee = await manager.findOne(Employee, {
          where: {
            id: leaveRequest.employeeId,
            tenantId,
          },
          lock: {
            mode: 'pessimistic_write',
          },
        });

        if (!employee) {
          throw new NotFoundException(
              'Employee not found.',
          );
        }

        if (
            employee.annualLeaveBalance <
            leaveRequest.daysRequested
        ) {
          throw new UnprocessableEntityException(
              'Insufficient leave balance.',
          );
        }

        employee.annualLeaveBalance -= leaveRequest.daysRequested;

        await manager.save(employee);
      }

      leaveRequest.status = LeaveStatus.APPROVED;
      leaveRequest.approvedBy = approverId;
      leaveRequest.approvedAt = new Date();

      if (idempotencyKey) {
        leaveRequest.idempotencyKey = idempotencyKey;
      }

      return manager.save(leaveRequest);
    });
  }

  async rejectLeaveRequest(
      requestId: string,
      dto: RejectLeaveRequestDto,
      approverId: string,
      tenantId: string,
  ): Promise<LeaveRequest> {
    return this.dataSource.transaction(async (manager) => {
      const leaveRequest = await manager.findOne(LeaveRequest, {
        where: {
          id: requestId,
          tenantId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!leaveRequest) {
        throw new NotFoundException(
            'Leave request not found.',
        );
      }

      if (leaveRequest.status !== LeaveStatus.PENDING) {
        throw new ConflictException(
            `Cannot reject a ${leaveRequest.status} leave request.`,
        );
      }

      leaveRequest.status = LeaveStatus.REJECTED;
      leaveRequest.rejectedBy = approverId;
      leaveRequest.rejectedAt = new Date();
      leaveRequest.rejectionComment = dto.comment;

      return manager.save(leaveRequest);
    });
  }

  async listLeaveRequests(
      query: ListLeaveRequestsDto,
      tenantId: string,
  ): Promise<LeaveRequest[]> {
    return this.leaveRequestRepository.findAll(
        tenantId,
        {
          status: query.status,
          employeeId: query.employeeId,
        },
    );
  }

}