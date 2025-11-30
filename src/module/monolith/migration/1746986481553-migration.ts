import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1746986481553 implements MigrationInterface {
  name = 'Migration1746986481553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Video" DROP CONSTRAINT "FK_46efd1060cb7a7c545b06120d14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" ALTER COLUMN "movieId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" ADD CONSTRAINT "FK_46efd1060cb7a7c545b06120d14" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Video" DROP CONSTRAINT "FK_46efd1060cb7a7c545b06120d14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" ALTER COLUMN "movieId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" ADD CONSTRAINT "FK_46efd1060cb7a7c545b06120d14" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
