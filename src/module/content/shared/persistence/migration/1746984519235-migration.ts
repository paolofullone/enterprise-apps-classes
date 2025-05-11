import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1746984519235 implements MigrationInterface {
  name = 'Migration1746984519235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" ADD "version" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "TvShow" DROP CONSTRAINT "FK_b6ac53aff4b7200e4b01ca43a9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TvShow" ALTER COLUMN "contentId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "TvShow" ADD CONSTRAINT "FK_b6ac53aff4b7200e4b01ca43a9c" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "TvShow" DROP CONSTRAINT "FK_b6ac53aff4b7200e4b01ca43a9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "TvShow" ALTER COLUMN "contentId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "TvShow" ADD CONSTRAINT "FK_b6ac53aff4b7200e4b01ca43a9c" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" DROP COLUMN "version"`,
    );
  }
}
