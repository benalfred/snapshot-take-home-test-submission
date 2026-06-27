import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782588505475 implements MigrationInterface {
    name = 'InitialSchema1782588505475'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c7920fb29b588a51fdde280908"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a00024776c7192f02e0ff6e8f"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "UQ_e3d0372d1ebe64cf827743666ce"`);
        await queryRunner.query(`ALTER TABLE "employees" DROP CONSTRAINT "UQ_765bc1ac8967533a04c74a9f6af"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5a00024776c7192f02e0ff6e8f" ON "employees" ("tenantId", "email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c7920fb29b588a51fdde280908" ON "employees" ("tenantId", "employeeCode") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c7920fb29b588a51fdde280908"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a00024776c7192f02e0ff6e8f"`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "UQ_765bc1ac8967533a04c74a9f6af" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "employees" ADD CONSTRAINT "UQ_e3d0372d1ebe64cf827743666ce" UNIQUE ("employeeCode")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5a00024776c7192f02e0ff6e8f" ON "employees" ("email", "tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c7920fb29b588a51fdde280908" ON "employees" ("employeeCode", "tenantId") `);
    }

}
