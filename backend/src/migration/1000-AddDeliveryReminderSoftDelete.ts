import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryReminderSoftDelete10001700000000001 implements MigrationInterface {
  name = 'AddDeliveryReminderSoftDelete10001700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE delivery_reminders
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE delivery_reminders
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE delivery_reminders
      ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE delivery_reminders DROP COLUMN IF EXISTS deleted_by`);
    await queryRunner.query(`ALTER TABLE delivery_reminders DROP COLUMN IF EXISTS deleted_at`);
    await queryRunner.query(`ALTER TABLE delivery_reminders DROP COLUMN IF EXISTS is_deleted`);
  }
}

