import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToSessions1748476800006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enforces the uniqueness rule at the database level (Section 4.5).
    // The application-level duplicate check in SessionsService is retained as a
    // fast-path with a meaningful error message, but this constraint is the
    // authoritative guard against concurrent duplicate inserts.
    await queryRunner.query(`
      ALTER TABLE "sessions"
        ADD CONSTRAINT "UQ_sessions_offering_id_starts_at_ends_at"
        UNIQUE ("offering_id", "starts_at", "ends_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
        DROP CONSTRAINT "UQ_sessions_offering_id_starts_at_ends_at"
    `);
  }
}
