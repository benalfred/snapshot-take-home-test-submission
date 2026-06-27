import {Controller, Get, Param, ParseUUIDPipe} from "@nestjs/common";
import {Tenant} from "../common/decorators/tenant.decorator";
import {EmployeesService} from "./employees.service";

@Controller('employees')
export class EmployeesController {
    constructor(
        private readonly employeesService: EmployeesService,
    ) {
    }

    @Get(':id/leave-balance')
    getLeaveBalance(
        @Param('id', ParseUUIDPipe)
        employeeId: string,
        @Tenant()
        tenantId: string,
    ) {
        return this.employeesService.getLeaveBalance(
            employeeId,
            tenantId,
        );
    }

    @Get("/list")
    listEmployees() {
        return this.employeesService.listEmployees()
    }
}