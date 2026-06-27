import {
  IsString,
  IsIn,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

export class SubmitLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsIn(['ANNUAL', 'SICK', 'UNPAID'])
  leaveType: 'ANNUAL' | 'SICK' | 'UNPAID';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RejectLeaveRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Comment is required when rejecting a leave request' })
  comment: string;
}

export class ListLeaveRequestsQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  employeeId?: string;
}
