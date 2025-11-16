-- 跟单系统数据库设计
-- PostgreSQL

-- 用户表（客户和管理员）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    customer_code VARCHAR(50) UNIQUE, -- 客户编号，管理员可以为空
    role VARCHAR(20) NOT NULL DEFAULT 'customer', -- 'customer'、'admin' 或 'production_manager'
    assigned_order_types JSONB DEFAULT '[]'::jsonb, -- 生产跟单的订单类型权限，如：['required', 'scattered', 'photo']
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
    estimated_ship_date DATE, -- 预计出货日期
    actual_ship_date DATE, -- 实际出货日期
    notes TEXT, -- 情况备注
    internal_notes TEXT, -- 内部备注（仅管理员可见）
    images JSONB DEFAULT '[]'::jsonb, -- 订单图片URL数组
    shipping_tracking_numbers JSONB DEFAULT '[]'::jsonb, -- 发货单号数组，格式：[{"type": "main", "number": "SF123456", "label": "主单号"}, ...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) -- 创建者ID（管理员）
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
    resolved_at TIMESTAMP
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_code ON orders(customer_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_is_completed ON orders(is_completed);
CREATE INDEX IF NOT EXISTS idx_orders_can_ship ON orders(can_ship);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_order_id ON delivery_reminders(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_customer_id ON delivery_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_is_admin_assigned ON delivery_reminders(is_admin_assigned);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_assigned_to ON delivery_reminders(assigned_to);

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

