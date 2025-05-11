import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1746986400359 implements MigrationInterface {
  name = 'Migration1746986400359';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" DROP CONSTRAINT "FK_678d67fbd94f3a4f4c57a0507b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" ALTER COLUMN "transcript" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" ALTER COLUMN "videoId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "Movie" DROP CONSTRAINT "FK_c155b5944bdd1e260a4ae79bc82"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Movie" ALTER COLUMN "contentId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" DROP CONSTRAINT "FK_46efd1060cb7a7c545b06120d14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" ALTER COLUMN "movieId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" ADD CONSTRAINT "FK_678d67fbd94f3a4f4c57a0507b0" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Movie" ADD CONSTRAINT "FK_c155b5944bdd1e260a4ae79bc82" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
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
      `ALTER TABLE "Movie" DROP CONSTRAINT "FK_c155b5944bdd1e260a4ae79bc82"`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" DROP CONSTRAINT "FK_678d67fbd94f3a4f4c57a0507b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" ALTER COLUMN "movieId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "Video" ADD CONSTRAINT "FK_46efd1060cb7a7c545b06120d14" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Movie" ALTER COLUMN "contentId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "Movie" ADD CONSTRAINT "FK_c155b5944bdd1e260a4ae79bc82" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" ALTER COLUMN "videoId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" ALTER COLUMN "transcript" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "VideoMetadata" ADD CONSTRAINT "FK_678d67fbd94f3a4f4c57a0507b0" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
