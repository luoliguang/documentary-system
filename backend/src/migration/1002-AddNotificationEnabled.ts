import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationEnabled10021700000000003 implements MigrationInterface {
  name = 'AddNotificationEnabled10021700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT false
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN users.notification_enabled IS '是否启用桌面通知（默认关闭）'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS notification_enabled
    `);
  }
}

