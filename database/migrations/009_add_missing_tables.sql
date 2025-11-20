-- 迁移脚本：添加缺失的数据库表
-- 版本：009
-- 描述：添加 order_follow_ups、notifications、system_configs 表
-- 执行日期：2024年

-- 订单跟进记录表
CREATE TABLE IF NOT EXISTS order_follow_ups (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    production_manager_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_visible_to_customer BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'reminder', 'assignment'
    title VARCHAR(255) NOT NULL,
    content TEXT,
    related_id INTEGER, -- 关联ID（订单ID或催货ID）
    related_type VARCHAR(20), -- 关联类型：'order', 'reminder'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_order_follow_ups_order_id ON order_follow_ups(order_id);
CREATE INDEX IF NOT EXISTS idx_order_follow_ups_production_manager_id ON order_follow_ups(production_manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_id, related_type);
CREATE INDEX IF NOT EXISTS idx_system_configs_config_key ON system_configs(config_key);

-- 创建更新时间触发器（如果函数不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为order_follow_ups表创建更新触发器
DROP TRIGGER IF EXISTS update_order_follow_ups_updated_at ON order_follow_ups;
CREATE TRIGGER update_order_follow_ups_updated_at BEFORE UPDATE ON order_follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为system_configs表创建更新触发器
DROP TRIGGER IF EXISTS update_system_configs_updated_at ON system_configs;
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 添加order_date字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN order_date TIMESTAMP;
        COMMENT ON COLUMN orders.order_date IS '下单时间';
    END IF;
END $$;

-- 确保estimated_ship_date是TIMESTAMP类型（如果当前是DATE类型）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
          AND column_name = 'estimated_ship_date' 
          AND data_type = 'date'
    ) THEN
        ALTER TABLE orders ALTER COLUMN estimated_ship_date TYPE TIMESTAMP USING estimated_ship_date::TIMESTAMP;
        COMMENT ON COLUMN orders.estimated_ship_date IS '预计出货日期（日期+时间）';
    END IF;
END $$;

-- 验证迁移结果
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('order_follow_ups', 'notifications', 'system_configs');
    
    IF table_count < 3 THEN
        RAISE EXCEPTION '迁移失败：部分表未创建成功';
    END IF;
    
    RAISE NOTICE '迁移成功：所有表已创建';
END $$;

