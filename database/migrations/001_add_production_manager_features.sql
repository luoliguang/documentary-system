-- 迁移脚本：添加生产跟单功能
-- 执行日期：2024

-- 1. 更新用户表：添加生产跟单的订单类型权限字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS assigned_order_types JSONB DEFAULT '[]'::jsonb;

-- 2. 更新用户表的role字段，支持production_manager
-- 注意：PostgreSQL的CHECK约束需要先删除再添加，这里使用注释说明
-- 实际使用时，role字段已经是VARCHAR(20)，可以存储任何值，不需要修改

-- 3. 更新订单表：添加订单类型字段和分配字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'required';

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id);

-- 为现有订单设置默认订单类型（必发）
UPDATE orders 
SET order_type = 'required' 
WHERE order_type IS NULL;

-- 添加订单类型索引
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- 添加订单分配索引
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);

-- 4. 更新催货记录表：添加管理员派送任务相关字段
ALTER TABLE delivery_reminders 
ADD COLUMN IF NOT EXISTS is_admin_assigned BOOLEAN DEFAULT false;

ALTER TABLE delivery_reminders 
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_is_admin_assigned ON delivery_reminders(is_admin_assigned);
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_assigned_to ON delivery_reminders(assigned_to);

-- 5. 添加管理员备注字段（用于用户管理）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 6. 添加注释说明
COMMENT ON COLUMN users.assigned_order_types IS '生产跟单的订单类型权限，JSONB数组，如：["required", "scattered", "photo"]';
COMMENT ON COLUMN users.admin_notes IS '管理员备注，用于标识具体客户信息，仅管理员可见和编辑';
COMMENT ON COLUMN orders.order_type IS '订单类型：required(必发)、scattered(散单)、photo(拍照)';
COMMENT ON COLUMN orders.assigned_to IS '分配给哪个生产跟单的用户ID，如果指定则只有该生产跟单可以看到此订单';
COMMENT ON COLUMN delivery_reminders.is_admin_assigned IS '是否为管理员派送的催货任务，生产跟单只能查看此字段为true的记录';
COMMENT ON COLUMN delivery_reminders.assigned_to IS '分配给哪个生产跟单的用户ID，如果指定则只有该生产跟单可以看到';

