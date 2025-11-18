-- 通知表：用于存储系统通知和提醒
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 接收通知的用户
    type VARCHAR(50) NOT NULL, -- 通知类型: 'reminder' (催单提醒), 'assignment' (分配提醒)
    title VARCHAR(200) NOT NULL, -- 通知标题
    content TEXT, -- 通知内容
    related_id INTEGER, -- 关联的业务ID (订单ID或催货记录ID)
    related_type VARCHAR(50), -- 关联的业务类型: 'order', 'reminder'
    is_read BOOLEAN DEFAULT false, -- 是否已读
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    read_at TIMESTAMP -- 阅读时间
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- 添加注释
COMMENT ON TABLE notifications IS '系统通知表，用于存储各种提醒和通知';
COMMENT ON COLUMN notifications.user_id IS '接收通知的用户ID';
COMMENT ON COLUMN notifications.type IS '通知类型: reminder(催单提醒), assignment(分配提醒)';
COMMENT ON COLUMN notifications.title IS '通知标题';
COMMENT ON COLUMN notifications.content IS '通知内容';
COMMENT ON COLUMN notifications.related_id IS '关联的业务ID，如订单ID或催货记录ID';
COMMENT ON COLUMN notifications.related_type IS '关联的业务类型: order(订单), reminder(催货记录)';
COMMENT ON COLUMN notifications.is_read IS '是否已读';
COMMENT ON COLUMN notifications.created_at IS '创建时间';
COMMENT ON COLUMN notifications.read_at IS '阅读时间';

