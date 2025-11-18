-- 订单跟进记录表：用于存储生产跟单的跟进反馈
CREATE TABLE IF NOT EXISTS order_follow_ups (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    production_manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- 跟进内容
    is_visible_to_customer BOOLEAN DEFAULT true, -- 是否对客户可见
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_order_follow_ups_order_id ON order_follow_ups(order_id);
CREATE INDEX IF NOT EXISTS idx_order_follow_ups_production_manager_id ON order_follow_ups(production_manager_id);
CREATE INDEX IF NOT EXISTS idx_order_follow_ups_created_at ON order_follow_ups(created_at);

-- 添加注释
COMMENT ON TABLE order_follow_ups IS '订单跟进记录表，用于存储生产跟单的跟进反馈';
COMMENT ON COLUMN order_follow_ups.order_id IS '订单ID';
COMMENT ON COLUMN order_follow_ups.production_manager_id IS '生产跟单用户ID';
COMMENT ON COLUMN order_follow_ups.content IS '跟进内容';
COMMENT ON COLUMN order_follow_ups.is_visible_to_customer IS '是否对客户可见';

DROP TRIGGER IF EXISTS update_order_follow_ups_updated_at ON order_follow_ups;
CREATE TRIGGER update_order_follow_ups_updated_at BEFORE UPDATE ON order_follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

