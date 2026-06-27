import {EmployeesService} from "./employees.service";
import {TypeOrmModule} from "@nestjs/typeorm";
import {EmployeesController} from "./employees.controller";
import {EmployeeRepository} from "./repositories/employee.repository";
import {Module} from "@nestjs/common";
import {Employee} from "./entities/employee.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee]),
  ],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    EmployeeRepository,
  ],
  exports: [
    EmployeesService,
    EmployeeRepository,
  ],
})
export class EmployeesModule {}
