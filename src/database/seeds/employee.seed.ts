import { DataSource } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

export async function seedEmployees(dataSource: DataSource) {
    const repository = dataSource.getRepository(Employee);

    const employees: Partial<Employee>[] = [
        {
            tenantId: 'tenant-001',
            employeeCode: 'EMP001',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            annualLeaveBalance: 20,
        },
        {
            tenantId: 'tenant-001',
            employeeCode: 'EMP002',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@example.com',
            annualLeaveBalance: 15,
        },
        {
            tenantId: 'tenant-002',
            employeeCode: 'EMP001',
            firstName: 'Michael',
            lastName: 'Brown',
            email: 'michael.brown@example.com',
            annualLeaveBalance: 18,
        },
        {
            tenantId: 'tenant-002',
            employeeCode: 'EMP002',
            firstName: 'Sarah',
            lastName: 'Wilson',
            email: 'sarah.wilson@example.com',
            annualLeaveBalance: 25,
        },
    ];

    for (const employee of employees) {
        const exists = await repository.findOne({
            where: {
                tenantId: employee.tenantId,
                employeeCode: employee.employeeCode,
            },
        });

        if (!exists) {
            await repository.save(repository.create(employee));
        }

    }

    console.log('✅ Employees seeded successfully');
}