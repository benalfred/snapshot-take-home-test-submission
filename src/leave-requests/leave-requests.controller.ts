import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Headers,
    Query,
} from '@nestjs/common';
import {LeaveRequestsService} from './leave-requests.service';
import {RequiredHeader} from '../common/decorators/required-header.decorator';
import {Tenant} from '../common/decorators/tenant.decorator';
import {RejectLeaveRequestDto} from "./dto/reject-leave-request.dto";
import {ListLeaveRequestsDto} from "./dto/list-leave-request.dto";
import {CreateLeaveRequestDto} from "./dto/create-leave-request.dto";
import {ApproverRole} from "./enums/approver-role.enum";

@Controller('leave-requests')
export class LeaveRequestsController {
    constructor(
        private readonly leaveRequestsService: LeaveRequestsService,
    ) {
    }

    @Post()
    create(
        @Body() dto: CreateLeaveRequestDto,
        @Tenant()
        tenantId: string,
    ) {
        return this.leaveRequestsService.submitLeaveRequest(
            dto,
            tenantId,
        );
    }

    @Post(':id/approve')
    approve(
        @Param('id', ParseUUIDPipe)
        id: string,
        @RequiredHeader('x-approver-id')
        approverId: string,
        @RequiredHeader('x-approver-role')
        approverRole: ApproverRole,
        @Tenant()
        tenantId: string,
        @Headers('idempotency-key')
        idempotencyKey?: string,
    ) {
        return this.leaveRequestsService.approveLeaveRequest(
            id,
            approverId,
            approverRole,
            tenantId,
            idempotencyKey,
        );
    }

    @Post(':id/reject')
    reject(
        @Param('id', ParseUUIDPipe)
        id: string,
        @Body()
        dto: RejectLeaveRequestDto,
        @RequiredHeader('x-approver-id')
        approverId: string,
        @Tenant()
        tenantId: string,
    ) {
        return this.leaveRequestsService.rejectLeaveRequest(
            id,
            dto,
            approverId,
            tenantId,
        );
    }

    @Get()
    findAll(
        @Query()
        query: ListLeaveRequestsDto,
        @Tenant()
        tenantId: string,
    ) {
        return this.leaveRequestsService.listLeaveRequests(
            query,
            tenantId,
        );
    }
}