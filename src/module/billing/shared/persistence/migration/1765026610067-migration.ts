import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1765026610067 implements MigrationInterface {
    name = 'Migration1765026610067'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."PlanChangeRequest_status_enum" AS ENUM('PENDING_INVOICE', 'INVOICE_GENERATED', 'INVOICE_FAILED')`);
        await queryRunner.query(`CREATE TABLE "PlanChangeRequest" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "subscriptionId" uuid NOT NULL, "userId" character varying NOT NULL, "oldPlanId" uuid NOT NULL, "newPlanId" uuid NOT NULL, "effectiveDate" TIMESTAMP NOT NULL, "prorationCredit" numeric(10,2) NOT NULL DEFAULT '0', "prorationCharge" numeric(10,2) NOT NULL DEFAULT '0', "prorationCreditBreakdown" json, "prorationChargeBreakdown" json, "addOnsRemoved" json, "status" "public"."PlanChangeRequest_status_enum" NOT NULL DEFAULT 'PENDING_INVOICE', "invoiceId" uuid, "errorMessage" text, "retryCount" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_bea3202fb246c1bd228771daf5a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_2a6892272664808bbed46426175" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_e925dc5232f4f10aa5885ee74bc" FOREIGN KEY ("oldPlanId") REFERENCES "Plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_32ff3ec06cc928ea339015556b1" FOREIGN KEY ("newPlanId") REFERENCES "Plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "FK_da3d86bbd07986e9806183cc906" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_da3d86bbd07986e9806183cc906"`);
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_32ff3ec06cc928ea339015556b1"`);
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_e925dc5232f4f10aa5885ee74bc"`);
        await queryRunner.query(`ALTER TABLE "PlanChangeRequest" DROP CONSTRAINT "FK_2a6892272664808bbed46426175"`);
        await queryRunner.query(`DROP TABLE "PlanChangeRequest"`);
        await queryRunner.query(`DROP TYPE "public"."PlanChangeRequest_status_enum"`);
    }

}
