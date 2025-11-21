-- 跟单系统数据库设计
-- PostgreSQL

-- 用户表（客户和管理员）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    account VARCHAR(50) UNIQUE, -- 登录账号，仅允许字母、数字、下划线，用于登录认证（允许为空，向后兼容）
    username VARCHAR(50) NOT NULL, -- 用户名/显示名称，可以包含中文，用于显示
    password_hash VARCHAR(255) NOT NULL,
    customer_code VARCHAR(50) UNIQUE, -- 客户编号，管理员可以为空
    role VARCHAR(20) NOT NULL DEFAULT 'customer', -- 'customer'、'admin' 或 'production_manager'
    assigned_order_types JSONB DEFAULT '[]'::jsonb, -- 生产跟单的订单类型权限，如：['required', 'scattered', 'photo']
    permission_overrides JSONB DEFAULT '{}'::jsonb, -- 用户级权限覆盖（资源→权限键值）
    company_name VARCHAR(200), -- 公司名称
    contact_name VARCHAR(100), -- 联系人姓名
    email VARCHAR(100),
    phone VARCHAR(20),
    admin_notes TEXT, -- 管理员备注，用于标识具体客户信息
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL, -- 订单编号
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 客户ID
    customer_code VARCHAR(50), -- 客户编号（冗余字段，方便查询）
    customer_order_number VARCHAR(100), -- 客户自己的编号（客户可以提交）
    status VARCHAR(50) DEFAULT 'pending', -- 订单状态：pending, in_production, completed, shipped, cancelled
    order_type VARCHAR(20) DEFAULT 'required', -- 订单类型：required(必发)、scattered(散单)、photo(拍照)
    assigned_to INTEGER REFERENCES users(id), -- 分配给哪个生产跟单
    is_completed BOOLEAN DEFAULT false, -- 是否完成任务
    can_ship BOOLEAN DEFAULT false, -- 是否可以出货
    estimated_ship_date TIMESTAMP, -- 预计出货日期（日期+时间）
    actual_ship_date DATE, -- 实际出货日期
    order_date TIMESTAMP, -- 下单时间
    notes TEXT, -- 情况备注
    internal_notes TEXT, -- 内部备注（仅管理员可见）
    images JSONB DEFAULT '[]'::jsonb, -- 订单图片URL数组
    shipping_tracking_numbers JSONB DEFAULT '[]'::jsonb, -- 发货单号数组，格式：[{"type": "main", "number": "SF123456", "label": "主单号"}, ...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) -- 创建者ID（管理员）
);

-- 订单与生产跟单分配关系表（支持多对多）
CREATE TABLE IF NOT EXISTS order_assignments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    production_manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, production_manager_id)
);

-- 催货记录表
CREATE TABLE IF NOT EXISTS delivery_reminders (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type VARCHAR(20) DEFAULT 'normal', -- normal, urgent
    message TEXT,
    admin_response TEXT, -- 管理员回复
    is_admin_assigned BOOLEAN DEFAULT false, -- 是否为管理员派送的催货任务
    assigned_to INTEGER REFERENCES users(id), -- 分配给哪个生产跟单
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false, -- 软删除标记
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id)
);

-- 订单状态历史记录表
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    config_key VARCHAR(100) NOT NULL,
    config_type VARCHAR(50) NOT NULL DEFAULT 'general',
    version INTEGER NOT NULL DEFAULT 1,
    config_value JSONB NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_key, config_type)
);

CREATE TABLE IF NOT EXISTS system_config_versions (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    config_type VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_by INTEGER,
    diff JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_code ON orders(customer_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_is_completed ON orders(is_completed);
CREATE INDEX IF NOT EXISTS idx_orders_can_ship ON orders(can_ship);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_order_assignments_order_id ON order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_assignments_pm_id ON order_assignments(production_manager_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_order_id ON delivery_reminders(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_customer_id ON delivery_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_is_admin_assigned ON delivery_reminders(is_admin_assigned);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_assigned_to ON delivery_reminders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_order_follow_ups_order_id ON order_follow_ups(order_id);
CREATE INDEX IF NOT EXISTS idx_order_follow_ups_production_manager_id ON order_follow_ups(production_manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_id, related_type);
CREATE INDEX IF NOT EXISTS idx_system_configs_config_key ON system_configs(config_key);
CREATE INDEX IF NOT EXISTS idx_system_configs_type ON system_configs(config_type);
CREATE INDEX IF NOT EXISTS idx_system_config_versions_key ON system_config_versions(config_key, config_type);

-- 更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为orders表创建更新触发器
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为users表创建更新触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为order_follow_ups表创建更新触发器
CREATE TRIGGER update_order_follow_ups_updated_at BEFORE UPDATE ON order_follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 为system_configs表创建更新触发器
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认管理员账号（密码：admin123，需要在实际使用时修改）
-- 密码hash：$2a$10$r6qE6NwozPBc9FgxhtPKouPAmyZUA3Ghxqf4H1KhdvZN2NUQM.y9y
INSERT INTO users (username, password_hash, role, customer_code, company_name, contact_name)
VALUES (
    'admin',
    '$2a$10$r6qE6NwozPBc9FgxhtPKouPAmyZUA3Ghxqf4H1KhdvZN2NUQM.y9y',
    'admin',
    NULL,
    '系统管理',
    '管理员'
) ON CONFLICT (username) DO NOTHING;

