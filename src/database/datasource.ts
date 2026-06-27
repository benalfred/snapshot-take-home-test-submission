import 'dotenv/config';
import { DataSource } from 'typeorm';

import { Employee } from '../employees/entities/employee.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';

export const AppDataSource = new DataSource({
    type: 'postgres',

    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),

    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,

    entities: [Employee, LeaveRequest],

    migrations: ['src/database/migrations/*.ts'],

    synchronize: false,
});