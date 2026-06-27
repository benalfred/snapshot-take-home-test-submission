import {
    IsNotEmpty,
    IsString,
    MaxLength,
} from 'class-validator';

export class RejectLeaveRequestDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    comment: string;
}