import {EmployeeRepository} from "./repositories/employee.repository";
import {Injectable, NotFoundException} from "@nestjs/common";
import {Employee} from "./entities/employee.entity";

@Injectable()
export class EmployeesService {
    constructor(
        private readonly employeeRepository: EmployeeRepository,
    ) {}

    async findById(
        id: string,
        tenantId: string,
    ): Promise<Employee> {
        const employee = await this.employeeRepository.findById(
            id,
            tenantId,
        );

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        return employee;
    }

    async getLeaveBalance(
        employeeId: string,
        tenantId: string,
    ): Promise<number> {
        const employee = await this.findById(
            employeeId,
            tenantId,
        );

        return employee.annualLeaveBalance;
    }

    async updateLeaveBalance(
        employeeId: string,
        tenantId: string,
        balance: number,
    ): Promise<Employee> {
        const employee = await this.findById(
            employeeId,
            tenantId,
        );

        employee.annualLeaveBalance = balance;

        return this.employeeRepository.save(employee);
    }
}