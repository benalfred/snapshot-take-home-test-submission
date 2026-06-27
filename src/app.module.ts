import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { EmployeesModule } from './employees/employees.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';

@Module({
  imports: [DatabaseModule, EmployeesModule, LeaveRequestsModule],
})
export class AppModule {}
