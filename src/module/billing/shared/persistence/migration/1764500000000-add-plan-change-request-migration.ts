import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanChangeRequestMigration1764500000000
  implements MigrationInterface
{
  name = 'AddPlanChangeRequestMigration1764500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for PlanChangeStatus
    await queryRunner.query(
      `CREATE TYPE "public"."PlanChangeRequest_status_enum" AS ENUM('PENDING_INVOICE', 'INVOICE_GENERATED', 'INVOICE_FAILED')`,
    );

    // Create PlanChangeRequest table
    await queryRunner.query(
      `CREATE TABLE "PlanChangeRequest" (
        "id" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        "subscriptionId" uuid NOT NULL,
        "userId" character varying NOT NULL,
        "oldPlanId" uuid NOT NULL,
        "newPlanId" uuid NOT NULL,
        "effectiveDate" TIMESTAMP NOT NULL,
        "prorationCredit" numeric(10,2) NOT NULL DEFAULT '0',
        "prorationCharge" numeric(10,2) NOT NULL DEFAULT '0',
        "prorationCreditBreakdown" json,
        "prorationChargeBreakdown" json,
        "addOnsRemoved" json,
        "status" "public"."PlanChangeRequest_status_enum" NOT NULL DEFAULT 'PENDING_INVOICE',
        "invoiceId" uuid,
        "errorMessage" text,
        "retryCount" integer NOT NULL DEFAULT '0',
        CONSTRAINT "PK_plan_change_request_id" PRIMARY KEY ("id")
      )`,
    );

    // Create index for status queries
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_change_request_status" ON "PlanChangeRequest" ("status")`,
    );

    // Create index for subscription queries
    await queryRunner.query(
      `CREATE INDEX "IDX_plan_change_request_subscription" ON "PlanChangeRequest" ("subscriptionId")`,
    );

    // Add foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_plan_change_request_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_plan_change_request_old_plan" FOREIGN KEY ("oldPlanId") REFERENCES "Plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_plan_change_request_new_plan" FOREIGN KEY ("newPlanId") REFERENCES "Plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_plan_change_request_invoice" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_plan_change_request_invoice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_plan_change_request_new_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_plan_change_request_old_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_plan_change_request_subscription"`,
    );

    // Drop indexes
    await queryRunner.query(
      `DROP INDEX "public"."IDX_plan_change_request_subscription"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_plan_change_request_status"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE "PlanChangeRequest"`);

    // Drop enum
    await queryRunner.query(
      `DROP TYPE "public"."PlanChangeRequest_status_enum"`,
    );
  }
}
