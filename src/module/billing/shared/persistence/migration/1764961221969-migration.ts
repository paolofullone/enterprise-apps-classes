import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1764961221969 implements MigrationInterface {
  name = 'Migration1764961221969';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "DomainEventsOutbox" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "DomainEventsOutbox" ADD "deletedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "DomainEventsOutbox" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "DomainEventsOutbox" DROP COLUMN "updatedAt"`,
    );
  }
}
