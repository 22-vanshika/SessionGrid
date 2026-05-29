import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoursesTable1748476800002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "courses" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "teacher_id"  UUID        NOT NULL,
        "title"       VARCHAR     NOT NULL,
        "description" TEXT,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_courses_teacher_id" FOREIGN KEY ("teacher_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    // Serves: list all courses created by a specific teacher (GET /courses?teacherId=...).
    await queryRunner.query(`
      CREATE INDEX "IDX_courses_teacher_id" ON "courses" ("teacher_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_courses_teacher_id"`);
    await queryRunner.query(`DROP TABLE "courses"`);
  }
}
