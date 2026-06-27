import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import {Employee} from '../../employees/entities/employee.entity';
import {LeaveStatus} from "../enums/leave-status.enum";
import {BaseEntity} from "../../common/entities/base.entity";
import {LeaveType} from "../enums/leave-type.enum";
import {TenantEntity} from "../../common/entities/tenantEntity";

@Entity('leave_requests')
@Index(['tenantId', 'employeeId'])
@Index(['tenantId', 'status'])
export class LeaveRequest extends TenantEntity {

    @Column()
    employeeId: string;

    @ManyToOne(() => Employee, (employee) => employee.leaveRequests, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({name: 'employeeId'})
    employee: Employee;

    @Column({
        type: 'enum',
        enum: LeaveType,
    })
    leaveType: LeaveType;

    @Column({
        type: 'date',
    })
    startDate: Date;

    @Column({
        type: 'date',
    })
    endDate: Date;

    @Column({
        type: 'int',
    })
    daysRequested: number;

    @Column({
        type: 'text',
        nullable: true,
    })
    reason?: string;

    @Column({
        type: 'enum',
        enum: LeaveStatus,
        default: LeaveStatus.PENDING,
    })
    status: LeaveStatus;

    @Column({
        nullable: true,
    })
    approvedBy?: string;

    @Column({
        type: 'timestamp',
        nullable: true,
    })
    approvedAt?: Date;

    @Column({
        nullable: true,
    })
    rejectedBy?: string;

    @Column({
        type: 'timestamp',
        nullable: true,
    })
    rejectedAt?: Date;

    @Column({
        type: 'text',
        nullable: true,
    })
    rejectionComment?: string;

    @Column({
        nullable: true,
        unique: true,
    })
    idempotencyKey?: string;

}