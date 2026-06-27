import {Injectable, NotFoundException} from "@nestjs/common";
import {EmployeeRepository} from "./repositories/employee.repository";
import {Employee} from "./entities/employee.entity";

@Injectable()
export class EmployeesService {
    constructor(
        private readonly employeeRepository: EmployeeRepository,
    ) {}

    async findById(
        employeeId: string,
        tenantId: string,
    ): Promise<Employee> {
        const employee = await this.employeeRepository.findById(
            employeeId,
            tenantId,
        );

        if (!employee) {
            throw new NotFoundException(
                `Employee with id ${employeeId} not found.`,
            );
        }

        return employee;
    }

    async getLeaveBalance(
        employeeId: string,
        tenantId: string,
    ): Promise<{ remainingDays: number }> {
        const employee = await this.findById(
            employeeId,
            tenantId,
        );

        return {
            remainingDays: employee.annualLeaveBalance,
        };
    }

    async listEmployees():Promise<Employee[]>{
        return await this.employeeRepository.findAll();
    }
}