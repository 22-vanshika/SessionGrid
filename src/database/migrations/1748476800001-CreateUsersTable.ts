import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1748476800001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM ('teacher', 'parent')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            UUID              NOT NULL DEFAULT gen_random_uuid(),
        "email"         VARCHAR           NOT NULL,
        "password_hash" VARCHAR           NOT NULL,
        "first_name"    VARCHAR           NOT NULL,
        "last_name"     VARCHAR           NOT NULL,
        "role"          "users_role_enum" NOT NULL,
        "timezone"      VARCHAR           NOT NULL,
        "created_at"    TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id"    PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE      ("email")
      )
    `);

    // UQ_users_email automatically creates a B-tree index on "email".
    // This index serves the user-lookup-by-email query executed during authentication.
    // No additional index on this table is required at this stage.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
