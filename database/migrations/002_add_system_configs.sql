-- 迁移脚本：添加系统配置管理功能
-- 执行日期：2024

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_system_configs_config_key ON system_configs(config_key);

-- 初始化角色配置
INSERT INTO system_configs (config_key, config_value, description)
VALUES (
  'roles',
  '[
    {"value": "admin", "label": "管理员"},
    {"value": "production_manager", "label": "生产跟单"},
    {"value": "customer", "label": "客户"}
  ]'::jsonb,
  '系统角色配置'
) ON CONFLICT (config_key) DO NOTHING;

-- 初始化订单类型配置
INSERT INTO system_configs (config_key, config_value, description)
VALUES (
  'order_types',
  '[
    {"value": "required", "label": "必发"},
    {"value": "scattered", "label": "散单"},
    {"value": "photo", "label": "拍照"}
  ]'::jsonb,
  '订单类型配置'
) ON CONFLICT (config_key) DO NOTHING;

-- 初始化订单状态配置
INSERT INTO system_configs (config_key, config_value, description)
VALUES (
  'order_statuses',
  '[
    {"value": "pending", "label": "待处理"},
    {"value": "in_production", "label": "生产中"},
    {"value": "completed", "label": "已完成"},
    {"value": "shipped", "label": "已发货"},
    {"value": "cancelled", "label": "已取消"}
  ]'::jsonb,
  '订单状态配置'
) ON CONFLICT (config_key) DO NOTHING;

-- 初始化权限配置
INSERT INTO system_configs (config_key, config_value, description)
VALUES (
  'role_permissions',
  '{
    "admin": {
      "orders": {
        "can_view_all": true,
        "can_create": true,
        "can_update": true,
        "can_delete": true,
        "can_update_completed": true,
        "can_update_can_ship": true,
        "can_update_estimated_ship_date": true,
        "can_update_notes": true,
        "can_update_status": true,
        "can_update_order_type": true,
        "can_view_internal_notes": true
      },
      "reminders": {
        "can_view_all": true,
        "can_create": true,
        "can_update": true,
        "can_delete": true,
        "can_assign": true
      },
      "users": {
        "can_view_all": true,
        "can_create": true,
        "can_update": true,
        "can_delete": true
      },
      "configs": {
        "can_view": true,
        "can_update": true
      }
    },
    "production_manager": {
      "orders": {
        "can_view_assigned": true,
        "can_update_completed": true,
        "can_update_can_ship": true,
        "can_update_estimated_ship_date": true,
        "can_update_notes": true,
        "can_update_status": false,
        "can_update_order_type": false,
        "can_view_internal_notes": false
      },
      "reminders": {
        "can_view_assigned": true,
        "can_create": false,
        "can_update": false,
        "can_delete": false
      }
    },
    "customer": {
      "orders": {
        "can_view_own": true,
        "can_create": true,
        "can_update": false
      }
    }
  }'::jsonb,
  '角色权限配置'
) ON CONFLICT (config_key) DO NOTHING;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_system_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_update_system_configs_updated_at ON system_configs;

-- 创建更新时间触发器
CREATE TRIGGER trigger_update_system_configs_updated_at
    BEFORE UPDATE ON system_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_system_configs_updated_at();

-- 添加注释说明
COMMENT ON TABLE system_configs IS '系统配置表，用于存储角色、订单类型、订单状态、权限等配置';
COMMENT ON COLUMN system_configs.config_key IS '配置键，如：roles, order_types, order_statuses, role_permissions';
COMMENT ON COLUMN system_configs.config_value IS '配置值，JSONB格式';
COMMENT ON COLUMN system_configs.description IS '配置说明';

