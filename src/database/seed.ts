import {seedEmployees} from "./employee.seed";
import {AppDataSource} from "../datasource";

async function bootstrap() {
    try {
        await AppDataSource.initialize();

        console.log('🌱 Seeding database...');

        await seedEmployees(AppDataSource);

        console.log('✅ Database seeded successfully.');

        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);

        process.exit(1);
    }
}

bootstrap();