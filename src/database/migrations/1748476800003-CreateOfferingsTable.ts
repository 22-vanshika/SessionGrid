import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOfferingsTable1748476800003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "offerings_status_enum" AS ENUM ('draft', 'published', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE "offerings" (
        "id"         UUID                    NOT NULL DEFAULT gen_random_uuid(),
        "course_id"  UUID                    NOT NULL,
        "capacity"   INTEGER                 NOT NULL,
        "status"     "offerings_status_enum" NOT NULL DEFAULT 'draft',
        "created_at" TIMESTAMPTZ             NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offerings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_offerings_course_id" FOREIGN KEY ("course_id")
          REFERENCES "courses" ("id") ON DELETE RESTRICT
      )
    `);

    // Serves: list all offerings under a given course (GET /courses/:id/offerings).
    await queryRunner.query(`
      CREATE INDEX "IDX_offerings_course_id" ON "offerings" ("course_id")
    `);

    // Serves: filter offerings by publication status for the browse endpoint (GET /offerings?status=published).
    await queryRunner.query(`
      CREATE INDEX "IDX_offerings_status" ON "offerings" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_offerings_status"`);
    await queryRunner.query(`DROP INDEX "IDX_offerings_course_id"`);
    await queryRunner.query(`DROP TABLE "offerings"`);
    await queryRunner.query(`DROP TYPE "offerings_status_enum"`);
  }
}
