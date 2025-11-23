import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderNumberFeedbacks10031700000000001 implements MigrationInterface {
  name = 'CreateOrderNumberFeedbacks10031700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建订单编号反馈表
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_number_feedbacks (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_order_number VARCHAR(255) NOT NULL,
        message TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id),
        resolution_note TEXT,
        related_order_id INTEGER REFERENCES orders(id),
        deleted_at TIMESTAMP
      )
    `);

    // 创建索引
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_customer ON order_number_feedbacks(customer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_status ON order_number_feedbacks(status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_created ON order_number_feedbacks(created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_customer_order_number ON order_number_feedbacks(customer_order_number)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_feedback_customer_order_number`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_feedback_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_feedback_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_feedback_customer`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_number_feedbacks`);
  }
}

