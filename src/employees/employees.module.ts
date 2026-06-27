import {
  Controller,
  Get,
  Param,
  Headers,
  NotFoundException,
  Module,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { Employee } from '../common/types';

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class EmployeesService {
  constructor(private readonly db: DatabaseService) {}

  async findById(employeeId: string, tenantId: string): Promise<Employee> {
    const emp = await this.db.queryOne<Employee>(
      `SELECT * FROM employees WHERE id = $1 AND tenant_id = $2`,
      [employeeId, tenantId],
    );
    if (!emp) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }
    return emp;
  }

  async getLeaveBalance(
    employeeId: string,
    tenantId: string,
  ): Promise<{ employeeId: string; name: string; annualLeaveBalance: number }> {
    const emp = await this.findById(employeeId, tenantId);
    return {
      employeeId: emp.id,
      name: emp.name,
      annualLeaveBalance: emp.annual_leave_balance,
    };
  }
}

// ─── Controller ─────────────────────────────────────────────────────────────

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /**
   * GET /employees/:employeeId/leave-balance
   * Returns the employee's remaining annual leave days.
   */
  @Get(':employeeId/leave-balance')
  async getLeaveBalance(
    @Param('employeeId') employeeId: string,
    @Headers('x-tenant-id') tenantId: string = 'tenant-001',
  ) {
    return this.employeesService.getLeaveBalance(employeeId, tenantId);
  }
}

// ─── Module ─────────────────────────────────────────────────────────────────

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
