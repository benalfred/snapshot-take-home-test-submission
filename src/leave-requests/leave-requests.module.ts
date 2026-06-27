import { Module } from '@nestjs/common';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { EmployeesModule } from '../employees/employees.module';
import {TypeOrmModule} from "@nestjs/typeorm";
import {LeaveRequest} from "./entities/leave-request.entity";
import {Employee} from "../employees/entities/employee.entity";
import {LeaveRequestRepository} from "./repositories/leave-request.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveRequest,
      Employee,
    ]),
    EmployeesModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [
    LeaveRequestsService,
    LeaveRequestRepository,
  ],
})
export class LeaveRequestsModule {}
