import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1764960759733 implements MigrationInterface {
  name = 'Migration1764960759733';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "DomainEventsOutbox" ("id" uuid NOT NULL, "aggregateType" character varying(100) NOT NULL, "aggregateId" uuid NOT NULL, "eventType" character varying(100) NOT NULL, "payload" jsonb NOT NULL, "published" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP, CONSTRAINT "PK_20a0b1fb76567aae9b2b79f34a7" PRIMARY KEY ("id"))`,
    );

    // Index para buscar eventos pendentes eficientemente
    await queryRunner.query(
      `CREATE INDEX "IDX_OUTBOX_PENDING" ON "DomainEventsOutbox" ("published", "createdAt") WHERE published = false`,
    );

    // Index para queries por aggregate
    await queryRunner.query(
      `CREATE INDEX "IDX_OUTBOX_AGGREGATE" ON "DomainEventsOutbox" ("aggregateType", "aggregateId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_OUTBOX_AGGREGATE"`);
    await queryRunner.query(`DROP INDEX "IDX_OUTBOX_PENDING"`);
    await queryRunner.query(`DROP TABLE "DomainEventsOutbox"`);
  }
}
