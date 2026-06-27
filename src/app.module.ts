import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import {DatabaseModule} from "./database/database.module";
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    EmployeesModule,
    LeaveRequestsModule,
  ],
})
export class AppModule {}
