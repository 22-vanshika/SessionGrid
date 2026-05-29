import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessionsTable1748476800004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
        "offering_id" UUID        NOT NULL,
        "starts_at"   TIMESTAMPTZ NOT NULL,
        "ends_at"     TIMESTAMPTZ NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_sessions_ends_after_starts" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "FK_sessions_offering_id" FOREIGN KEY ("offering_id")
          REFERENCES "offerings" ("id") ON DELETE CASCADE
      )
    `);

    // Serves two queries:
    // (1) List all sessions for a given offering (GET /offerings/:id/sessions).
    // (2) Time-overlap conflict detection:
    //       WHERE offering_id = ANY($parentBookedOfferingIds)
    //         AND starts_at < $newSessionEndsAt
    //         AND ends_at   > $newSessionStartsAt
    //     The composite leading column (offering_id) narrows the scan; starts_at and ends_at
    //     allow the range filter to run against the index without a separate sort.
    await queryRunner.query(`
      CREATE INDEX "IDX_sessions_offering_id_starts_at_ends_at"
        ON "sessions" ("offering_id", "starts_at", "ends_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sessions_offering_id_starts_at_ends_at"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
  }
}
