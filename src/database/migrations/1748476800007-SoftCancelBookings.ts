import { MigrationInterface, QueryRunner } from 'typeorm';

export class SoftCancelBookings1748476800007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP CONSTRAINT "UQ_bookings_offering_id_parent_id"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_bookings_offering_id_parent_id_confirmed" 
      ON "bookings" ("offering_id", "parent_id") 
      WHERE "status" = 'confirmed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "UQ_bookings_offering_id_parent_id_confirmed"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "UQ_bookings_offering_id_parent_id" UNIQUE ("offering_id", "parent_id")
    `);
  }
}
