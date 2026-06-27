import {
    IsEnum,
    IsOptional,
    IsUUID,
} from 'class-validator';
import {LeaveStatus} from "../enums/leave-status.enum";


export class ListLeaveRequestsDto {
    @IsOptional()
    @IsEnum(LeaveStatus)
    status?: LeaveStatus;

    @IsOptional()
    @IsUUID()
    employeeId?: string;
}