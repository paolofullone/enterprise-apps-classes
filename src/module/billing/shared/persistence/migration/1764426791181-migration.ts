import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1764426791181 implements MigrationInterface {
  name = 'Migration1764426791181';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."Plan_interval_enum" AS ENUM('Day', 'Week', 'Month', 'Year')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Plan" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(100) NOT NULL, "description" character varying(255), "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL, "interval" "public"."Plan_interval_enum" NOT NULL, "trialPeriod" integer, "taxCategoryId" character varying(255), "allowedAddOns" json, "includedUsageQuotas" json, "features" json, "metadata" json, CONSTRAINT "PK_2239586f507efc3115f2ebf769b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingAddOn_addontype_enum" AS ENUM('UHD4K', 'OfflineDownload', 'MultiDevice', 'FamilySharing')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingAddOn" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(100) NOT NULL, "description" text, "addOnType" "public"."BillingAddOn_addontype_enum" NOT NULL, "price" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "requiresPlan" json, "isActive" boolean NOT NULL DEFAULT true, "taxCategoryId" character varying(255), "metadata" json, CONSTRAINT "PK_79873237a6f20f5681fe2ea7c1b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingSubscriptionAddOn" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "subscriptionId" uuid NOT NULL, "addOnId" uuid NOT NULL, "startDate" TIMESTAMP NOT NULL DEFAULT now(), "endDate" TIMESTAMP, "quantity" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_5b60242e2ac12ec0745e9d5842d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingDiscount_discounttype_enum" AS ENUM('Percentage', 'FixedAmount', 'FirstMonths', 'Referral', 'Bundle')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingDiscount" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "code" character varying(50) NOT NULL, "name" character varying(100) NOT NULL, "discountType" "public"."BillingDiscount_discounttype_enum" NOT NULL, "value" numeric(10,2) NOT NULL, "maxRedemptions" integer, "currentRedemptions" integer NOT NULL DEFAULT '0', "validFrom" TIMESTAMP NOT NULL, "validTo" TIMESTAMP, "applicablePlans" json, "isStackable" boolean NOT NULL DEFAULT false, "priority" integer NOT NULL DEFAULT '0', "metadata" json, CONSTRAINT "UQ_d568ec4320fa7adc4c1f1e0079d" UNIQUE ("code"), CONSTRAINT "PK_2c309ab1dbd99b7af2d7ee85bee" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingSubscriptionDiscount" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "subscriptionId" uuid NOT NULL, "discountId" uuid NOT NULL, "appliedAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP, "remainingMonths" integer, CONSTRAINT "PK_1cd3ae1069733ec99ded04fd123" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingInvoiceLineItem_chargetype_enum" AS ENUM('Subscription', 'Usage', 'AddOn', 'Proration', 'Tax', 'Discount')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingInvoiceLineItem_taxprovider_enum" AS ENUM('Standard', 'EasyTax', 'VatMoss')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingInvoiceLineItem" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "invoiceId" uuid NOT NULL, "description" text NOT NULL, "chargeType" "public"."BillingInvoiceLineItem_chargetype_enum" NOT NULL, "quantity" numeric(10,2) NOT NULL DEFAULT '0', "unitPrice" numeric(10,2) NOT NULL DEFAULT '0', "amount" numeric(10,2) NOT NULL DEFAULT '0', "taxAmount" numeric(10,2) NOT NULL DEFAULT '0', "taxRate" numeric(5,4) NOT NULL DEFAULT '0', "taxProvider" "public"."BillingInvoiceLineItem_taxprovider_enum", "taxJurisdiction" character varying(255), "discountAmount" numeric(10,2) NOT NULL DEFAULT '0', "totalAmount" numeric(10,2) NOT NULL DEFAULT '0', "periodStart" TIMESTAMP, "periodEnd" TIMESTAMP, "prorationRate" numeric(5,4), "metadata" json, CONSTRAINT "PK_b529a17e1ab9d607ea5ab825509" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingCharge_chargetype_enum" AS ENUM('Subscription', 'Usage', 'AddOn', 'Proration', 'Tax', 'Discount')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingCharge_status_enum" AS ENUM('Pending', 'Succeeded', 'Failed', 'Refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingCharge" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" character varying NOT NULL, "subscriptionId" uuid NOT NULL, "invoiceId" uuid, "chargeType" "public"."BillingCharge_chargetype_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "description" text NOT NULL, "taxAmount" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."BillingCharge_status_enum" NOT NULL DEFAULT 'Pending', "failureReason" text, "metadata" json, CONSTRAINT "PK_2850944af575d2ac79c10ad5f3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingPayment_status_enum" AS ENUM('Pending', 'Succeeded', 'Failed', 'Refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingPayment" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "invoiceId" uuid NOT NULL, "userId" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "status" "public"."BillingPayment_status_enum" NOT NULL DEFAULT 'Pending', "paymentMethod" character varying(100) NOT NULL, "failureReason" text, "transactionId" character varying(255), "processedAt" TIMESTAMP, "metadata" json, CONSTRAINT "PK_8a0d9a208e2a4a286e63673162f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingInvoice_status_enum" AS ENUM('Draft', 'Open', 'Paid', 'Void', 'Uncollectible')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingInvoice" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "invoiceNumber" character varying(100) NOT NULL, "userId" character varying NOT NULL, "subscriptionId" uuid NOT NULL, "status" "public"."BillingInvoice_status_enum" NOT NULL DEFAULT 'Draft', "subtotal" numeric(10,2) NOT NULL DEFAULT '0', "totalTax" numeric(10,2) NOT NULL DEFAULT '0', "totalDiscount" numeric(10,2) NOT NULL DEFAULT '0', "totalCredit" numeric(10,2) NOT NULL DEFAULT '0', "total" numeric(10,2) NOT NULL DEFAULT '0', "amountDue" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "billingPeriodStart" TIMESTAMP NOT NULL, "billingPeriodEnd" TIMESTAMP NOT NULL, "dueDate" TIMESTAMP NOT NULL, "paidAt" TIMESTAMP, CONSTRAINT "UQ_5f57e3be50aadc09dea9e8c19ec" UNIQUE ("invoiceNumber"), CONSTRAINT "PK_845c6520d9670d1eae23b4b89ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingDunningAttempt_stage_enum" AS ENUM('Retry1', 'Retry2', 'Retry3', 'Downgrade', 'Cancel')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingDunningAttempt_status_enum" AS ENUM('Pending', 'Succeeded', 'Failed', 'Refunded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingDunningAttempt" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "subscriptionId" uuid NOT NULL, "invoiceId" character varying NOT NULL, "stage" "public"."BillingDunningAttempt_stage_enum" NOT NULL, "attemptNumber" integer NOT NULL, "attemptedAt" TIMESTAMP NOT NULL DEFAULT now(), "nextAttemptAt" TIMESTAMP, "status" "public"."BillingDunningAttempt_status_enum" NOT NULL, "errorMessage" text, CONSTRAINT "PK_87840a4e89b243af22b974026e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."Subscription_status_enum" AS ENUM('Active', 'Inactive')`,
    );
    await queryRunner.query(
      `CREATE TABLE "Subscription" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" character varying NOT NULL, "planId" uuid NOT NULL, "status" "public"."Subscription_status_enum" NOT NULL DEFAULT 'Inactive', "startDate" TIMESTAMP NOT NULL DEFAULT now(), "endDate" TIMESTAMP, "autoRenew" boolean NOT NULL DEFAULT true, "currentPeriodStart" TIMESTAMP NOT NULL DEFAULT now(), "currentPeriodEnd" TIMESTAMP, "canceledAt" TIMESTAMP, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "trialEndsAt" TIMESTAMP, "billingAddress" json, "taxRegionId" character varying, "metadata" json, CONSTRAINT "PK_eb0d69496fa84cd24da9fc78edd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingUsageRecord_usagetype_enum" AS ENUM('StreamingHours', 'DownloadCount', 'Bandwidth4K', 'ApiCalls')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingUsageRecord" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "subscriptionId" uuid NOT NULL, "usageType" "public"."BillingUsageRecord_usagetype_enum" NOT NULL, "quantity" numeric(10,2) NOT NULL, "multiplier" numeric(5,2) NOT NULL DEFAULT '1', "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "metadata" json, "billedInInvoiceId" character varying, CONSTRAINT "PK_100ec4da458f544c8afd59f31f8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingTaxRate" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(100) NOT NULL, "country" character varying(2) NOT NULL, "state" character varying(50), "region" character varying(100) NOT NULL, "taxRate" numeric(5,4) NOT NULL, "useTaxRate" numeric(5,4) NOT NULL DEFAULT '0', "taxCategoryId" character varying(255) NOT NULL, "effectiveFrom" TIMESTAMP NOT NULL, "effectiveTo" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_50bc17280c939604bc0d4c52043" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingTaxCalculationError_taxprovider_enum" AS ENUM('Standard', 'EasyTax', 'VatMoss')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingTaxCalculationError" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "invoiceId" character varying NOT NULL, "taxProvider" "public"."BillingTaxCalculationError_taxprovider_enum" NOT NULL, "errorType" character varying(100) NOT NULL, "errorCode" character varying(50), "errorMessage" text NOT NULL, "traceId" character varying(100) NOT NULL, CONSTRAINT "PK_f2cf58f278ae0b1824700834ecd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingTaxCalculationSummary_taxprovider_enum" AS ENUM('Standard', 'EasyTax', 'VatMoss')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingTaxCalculationSummary" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "invoiceLineId" character varying NOT NULL, "taxName" character varying(255) NOT NULL, "taxableAmount" numeric(10,2) NOT NULL, "taxAmount" numeric(10,2) NOT NULL, "taxRate" numeric(5,4) NOT NULL, "useTaxAmount" numeric(10,2), "useTaxRate" numeric(5,4), "jurisdiction" character varying(255) NOT NULL, "taxProvider" "public"."BillingTaxCalculationSummary_taxprovider_enum" NOT NULL, CONSTRAINT "PK_0823b810ff5e3f4e2cf885ab4b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."BillingCredit_credittype_enum" AS ENUM('Refund', 'Service', 'Promotional', 'Proration')`,
    );
    await queryRunner.query(
      `CREATE TABLE "BillingCredit" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" character varying NOT NULL, "creditType" "public"."BillingCredit_credittype_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "remainingAmount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "description" text NOT NULL, "expiresAt" TIMESTAMP, "appliedToInvoiceId" character varying, "metadata" json, CONSTRAINT "PK_c4a656efea892cacb3444f19122" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionAddOn" ADD CONSTRAINT "FK_0617840be4e6a57992385dcde3b" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionAddOn" ADD CONSTRAINT "FK_b5bbac93c277597175248fc878a" FOREIGN KEY ("addOnId") REFERENCES "BillingAddOn"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionDiscount" ADD CONSTRAINT "FK_a8505e5d5aad9b7b537a799d261" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionDiscount" ADD CONSTRAINT "FK_b9b2017591ba004f9b185054efa" FOREIGN KEY ("discountId") REFERENCES "BillingDiscount"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingInvoiceLineItem" ADD CONSTRAINT "FK_23e2d337715f9a8cee89546de4a" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingCharge" ADD CONSTRAINT "FK_828f5b0a44c2864c268837e1374" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingCharge" ADD CONSTRAINT "FK_135913fd0fff1d6ec5ceb3dc574" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingPayment" ADD CONSTRAINT "FK_d5eb38261c6a7475825917ce385" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingInvoice" ADD CONSTRAINT "FK_c37f3b33ef017a62a1190448cfb" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingDunningAttempt" ADD CONSTRAINT "FK_87097cefdb48a247fc91b7933a3" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Subscription" ADD CONSTRAINT "FK_9cbb1f303cffaca2ca4b782191f" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingUsageRecord" ADD CONSTRAINT "FK_77317568dc76beb13df310458ce" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "BillingUsageRecord" DROP CONSTRAINT "FK_77317568dc76beb13df310458ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Subscription" DROP CONSTRAINT "FK_9cbb1f303cffaca2ca4b782191f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingDunningAttempt" DROP CONSTRAINT "FK_87097cefdb48a247fc91b7933a3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingInvoice" DROP CONSTRAINT "FK_c37f3b33ef017a62a1190448cfb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingPayment" DROP CONSTRAINT "FK_d5eb38261c6a7475825917ce385"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingCharge" DROP CONSTRAINT "FK_135913fd0fff1d6ec5ceb3dc574"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingCharge" DROP CONSTRAINT "FK_828f5b0a44c2864c268837e1374"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingInvoiceLineItem" DROP CONSTRAINT "FK_23e2d337715f9a8cee89546de4a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionDiscount" DROP CONSTRAINT "FK_b9b2017591ba004f9b185054efa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionDiscount" DROP CONSTRAINT "FK_a8505e5d5aad9b7b537a799d261"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionAddOn" DROP CONSTRAINT "FK_b5bbac93c277597175248fc878a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "BillingSubscriptionAddOn" DROP CONSTRAINT "FK_0617840be4e6a57992385dcde3b"`,
    );
    await queryRunner.query(`DROP TABLE "BillingCredit"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingCredit_credittype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "BillingTaxCalculationSummary"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingTaxCalculationSummary_taxprovider_enum"`,
    );
    await queryRunner.query(`DROP TABLE "BillingTaxCalculationError"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingTaxCalculationError_taxprovider_enum"`,
    );
    await queryRunner.query(`DROP TABLE "BillingTaxRate"`);
    await queryRunner.query(`DROP TABLE "BillingUsageRecord"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingUsageRecord_usagetype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "Subscription"`);
    await queryRunner.query(`DROP TYPE "public"."Subscription_status_enum"`);
    await queryRunner.query(`DROP TABLE "BillingDunningAttempt"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingDunningAttempt_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."BillingDunningAttempt_stage_enum"`,
    );
    await queryRunner.query(`DROP TABLE "BillingInvoice"`);
    await queryRunner.query(`DROP TYPE "public"."BillingInvoice_status_enum"`);
    await queryRunner.query(`DROP TABLE "BillingPayment"`);
    await queryRunner.query(`DROP TYPE "public"."BillingPayment_status_enum"`);
    await queryRunner.query(`DROP TABLE "BillingCharge"`);
    await queryRunner.query(`DROP TYPE "public"."BillingCharge_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingCharge_chargetype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "BillingInvoiceLineItem"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingInvoiceLineItem_taxprovider_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."BillingInvoiceLineItem_chargetype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "BillingSubscriptionDiscount"`);
    await queryRunner.query(`DROP TABLE "BillingDiscount"`);
    await queryRunner.query(
      `DROP TYPE "public"."BillingDiscount_discounttype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "BillingSubscriptionAddOn"`);
    await queryRunner.query(`DROP TABLE "BillingAddOn"`);
    await queryRunner.query(`DROP TYPE "public"."BillingAddOn_addontype_enum"`);
    await queryRunner.query(`DROP TABLE "Plan"`);
    await queryRunner.query(`DROP TYPE "public"."Plan_interval_enum"`);
  }
}
