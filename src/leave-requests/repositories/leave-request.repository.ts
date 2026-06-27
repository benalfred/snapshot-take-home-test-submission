import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    DataSource,
    FindOptionsWhere,
    Repository,
} from 'typeorm';

import { LeaveRequest } from '../entities/leave-request.entity';
import {LeaveStatus} from "../enums/leave-status.enum";

@Injectable()
export class LeaveRequestRepository {
    constructor(
        @InjectRepository(LeaveRequest)
        private readonly repository: Repository<LeaveRequest>,

        private readonly dataSource: DataSource,
    ) {}

    create(data: Partial<LeaveRequest>) {
        return this.repository.create(data);
    }


    async findAll(
        tenantId: string,
        filters?: {
            status?: LeaveStatus;
            employeeId?: string;
        },
    ): Promise<LeaveRequest[]> {
        const queryBuilder = this.repository
            .createQueryBuilder('leaveRequest')
            .leftJoinAndSelect(
                'leaveRequest.employee',
                'employee',
            )
            .where('leaveRequest.tenantId = :tenantId', {
                tenantId,
            });

        if (filters?.status) {
            queryBuilder.andWhere(
                'leaveRequest.status = :status',
                {
                    status: filters.status,
                },
            );
        }

        if (filters?.employeeId) {
            queryBuilder.andWhere(
                'leaveRequest.employeeId = :employeeId',
                {
                    employeeId: filters.employeeId,
                },
            );
        }

        return queryBuilder
            .orderBy('leaveRequest.createdAt', 'DESC')
            .getMany();
    }
}