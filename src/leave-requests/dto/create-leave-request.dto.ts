import {
    IsDateString,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';
import {LeaveType} from "../enums/leave-type.enum";

export class CreateLeaveRequestDto {
    @IsUUID()
    employeeId: string;

    @IsEnum(LeaveType)
    leaveType: LeaveType;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}