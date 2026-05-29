import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingsTable1748476800005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM ('confirmed', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id"          UUID                   NOT NULL DEFAULT gen_random_uuid(),
        "offering_id" UUID                   NOT NULL,
        "parent_id"   UUID                   NOT NULL,
        "status"      "bookings_status_enum" NOT NULL DEFAULT 'confirmed',
        "created_at"  TIMESTAMPTZ            NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ            NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookings_offering_id_parent_id" UNIQUE ("offering_id", "parent_id"),
        CONSTRAINT "FK_bookings_offering_id" FOREIGN KEY ("offering_id")
          REFERENCES "offerings" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_bookings_parent_id" FOREIGN KEY ("parent_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);

    // Serves two queries:
    // (1) Fetch a parent's full booking history (GET /bookings for the authenticated parent).
    // (2) Pessimistic lock acquisition before the conflict check:
    //       SELECT ... FROM bookings WHERE parent_id = $parentId FOR UPDATE
    //     This lock serialises concurrent booking attempts for the same parent.
    // Note: UQ_bookings_offering_id_parent_id implicitly creates a B-tree index on
    //       (offering_id, parent_id), covering duplicate-booking checks at no extra cost.
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_parent_id" ON "bookings" ("parent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bookings_parent_id"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "bookings_status_enum"`);
  }
}
