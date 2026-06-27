import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782588242893 implements MigrationInterface {
    name = 'InitialSchema1782588242893'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."leave_requests_leavetype_enum" AS ENUM('ANNUAL', 'SICK', 'UNPAID')`);
        await queryRunner.query(`CREATE TYPE "public"."leave_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "leave_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "tenantId" character varying NOT NULL, "employeeId" uuid NOT NULL, "leaveType" "public"."leave_requests_leavetype_enum" NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "daysRequested" integer NOT NULL, "reason" text, "status" "public"."leave_requests_status_enum" NOT NULL DEFAULT 'PENDING', "approvedBy" character varying, "approvedAt" TIMESTAMP, "rejectedBy" character varying, "rejectedAt" TIMESTAMP, "rejectionComment" text, "idempotencyKey" character varying, CONSTRAINT "UQ_be327945236bbb3b3746e1f8049" UNIQUE ("idempotencyKey"), CONSTRAINT "PK_d3abcf9a16cef1450129e06fa9f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d2234f83aa1c148396f6147152" ON "leave_requests" ("tenantId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_071ecb586df096a20d1642ddf7" ON "leave_requests" ("tenantId", "employeeId") `);
        await queryRunner.query(`CREATE TABLE "employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "tenantId" character varying NOT NULL, "employeeCode" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "email" character varying NOT NULL, "annualLeaveBalance" integer NOT NULL DEFAULT '20', CONSTRAINT "UQ_e3d0372d1ebe64cf827743666ce" UNIQUE ("employeeCode"), CONSTRAINT "UQ_765bc1ac8967533a04c74a9f6af" UNIQUE ("email"), CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5a00024776c7192f02e0ff6e8f" ON "employees" ("tenantId", "email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c7920fb29b588a51fdde280908" ON "employees" ("tenantId", "employeeCode") `);
        await queryRunner.query(`ALTER TABLE "leave_requests" ADD CONSTRAINT "FK_4eda1468756ca831495e308e407" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "leave_requests" DROP CONSTRAINT "FK_4eda1468756ca831495e308e407"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c7920fb29b588a51fdde280908"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a00024776c7192f02e0ff6e8f"`);
        await queryRunner.query(`DROP TABLE "employees"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_071ecb586df096a20d1642ddf7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d2234f83aa1c148396f6147152"`);
        await queryRunner.query(`DROP TABLE "leave_requests"`);
        await queryRunner.query(`DROP TYPE "public"."leave_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."leave_requests_leavetype_enum"`);
    }

}
