import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultOrderOptions10011700000000002
  implements MigrationInterface
{
  name = 'SeedDefaultOrderOptions10011700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 默认订单类型
    await queryRunner.query(`
      INSERT INTO system_configs (
        config_key,
        config_type,
        version,
        config_value,
        description,
        metadata
      )
      VALUES (
        'order_types',
        'order_options',
        1,
        '[
          {"value": "required",  "label": "必发"},
          {"value": "scattered", "label": "散单"},
          {"value": "photo",     "label": "拍照"}
        ]'::jsonb,
        '订单类型选项',
        '{}'::jsonb
      )
      ON CONFLICT (config_key, config_type) DO NOTHING;
    `);

    // 默认订单状态
    await queryRunner.query(`
      INSERT INTO system_configs (
        config_key,
        config_type,
        version,
        config_value,
        description,
        metadata
      )
      VALUES (
        'order_statuses',
        'order_options',
        1,
        '[
          {"value": "pending",       "label": "待处理"},
          {"value": "assigned",      "label": "已分配"},
          {"value": "in_production", "label": "生产中"},
          {"value": "completed",     "label": "已完成"},
          {"value": "shipped",       "label": "已发货"},
          {"value": "cancelled",     "label": "已取消"}
        ]'::jsonb,
        '订单状态选项',
        '{}'::jsonb
      )
      ON CONFLICT (config_key, config_type) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM system_configs
      WHERE config_key IN ('order_types', 'order_statuses')
        AND config_type = 'order_options';
    `);
  }
}


