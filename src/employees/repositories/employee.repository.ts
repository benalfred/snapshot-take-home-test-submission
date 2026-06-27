import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    FindOptionsWhere,
    Repository,
} from 'typeorm';

import { Employee } from '../entities/employee.entity';

@Injectable()
export class
EmployeeRepository {
    constructor(
        @InjectRepository(Employee)
        private readonly repository: Repository<Employee>,
    ) {}

    create(data: Partial<Employee>) {
        return this.repository.create(data);
    }

    save(employee: Employee) {
        return this.repository.save(employee);
    }

    findOne(where: FindOptionsWhere<Employee>) {
        return this.repository.findOne({
            where,
        });
    }

    findById(id: string, tenantId: string) {
        return this.repository.findOne({
            where: {
                id,
                tenantId,
            },
        });
    }

    findAll(){
        return this.repository.find();
    }
}