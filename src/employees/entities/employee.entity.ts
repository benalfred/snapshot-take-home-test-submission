import {
    Column,
    Entity,
    Index,
    OneToMany,
} from 'typeorm';
import { TenantEntity } from '../../common/entities/tenantEntity';
import { LeaveRequest } from '../../leave-requests/entities/leave-request.entity';

@Entity('employees')
@Index(['tenantId', 'employeeCode'], { unique: true })
@Index(['tenantId', 'email'], { unique: true })
export class Employee extends TenantEntity {
    @Column()
    tenantId: string;

    @Column()
    employeeCode: string;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column()
    email: string;

    @Column({
        type: 'int',
        default: 20,
    })
    annualLeaveBalance: number;

    @OneToMany(
        () => LeaveRequest,
        (leaveRequest) => leaveRequest.employee,
    )
    leaveRequests: LeaveRequest[];
}