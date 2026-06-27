import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import {
  SubmitLeaveRequestDto,
  RejectLeaveRequestDto,
  ListLeaveRequestsQueryDto,
} from './dto';

@Controller('leave-requests')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    exceptionFactory: (errors) => {
      const messages = errors.map((e) =>
        Object.values(e.constraints ?? {}).join(', '),
      );
      return new BadRequestException(messages);
    },
  }),
)
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  /**
   * POST /leave-requests
   * Submit a new leave request.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Body() dto: SubmitLeaveRequestDto,
    @Headers('x-tenant-id') tenantId: string = 'tenant-001',
  ) {
    return this.leaveRequestsService.submit(dto, tenantId);
  }

  /**
   * POST /leave-requests/:id/approve
   * Approve a pending leave request.
   * Idempotency: pass X-Idempotency-Key header for safe retries.
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @Headers('x-approver-id') approverId: string,
    @Headers('x-approver-role') approverRole: string,
    @Headers('x-tenant-id') tenantId: string = 'tenant-001',
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    if (!approverId) {
      throw new BadRequestException('X-Approver-Id header is required');
    }
    if (!approverRole) {
      throw new BadRequestException('X-Approver-Role header is required');
    }
    return this.leaveRequestsService.approve(
      id,
      approverId,
      approverRole,
      tenantId,
      idempotencyKey,
    );
  }

  /**
   * POST /leave-requests/:id/reject
   * Reject a pending leave request.
   */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @Headers('x-approver-id') rejecterId: string = 'manager-001',
    @Headers('x-tenant-id') tenantId: string = 'tenant-001',
  ) {
    return this.leaveRequestsService.reject(id, dto, rejecterId, tenantId);
  }

  /**
   * GET /leave-requests
   * List leave requests with optional filters.
   */
  @Get()
  async list(
    @Query() query: ListLeaveRequestsQueryDto,
    @Headers('x-tenant-id') tenantId: string = 'tenant-001',
  ) {
    return this.leaveRequestsService.list(query, tenantId);
  }

  /**
   * GET /leave-requests/:id
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string = 'tenant-001',
  ) {
    return this.leaveRequestsService.findById(id, tenantId);
  }
}
