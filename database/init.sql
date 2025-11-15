-- 初始化脚本示例
-- 创建测试客户账号

-- 测试客户1
INSERT INTO users (username, password_hash, role, customer_code, company_name, contact_name)
VALUES (
    'customer001',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- 密码：admin123
    'customer',
    'CUST001',
    '测试客户公司A',
    '张三'
) ON CONFLICT (username) DO NOTHING;

-- 测试订单
INSERT INTO orders (order_number, customer_id, customer_code, customer_order_number, status, notes, created_by)
SELECT 
    'ORD' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
    u.id,
    u.customer_code,
    'CUST-ORDER-001',
    'in_production',
    '测试订单备注',
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
FROM users u
WHERE u.customer_code = 'CUST001'
LIMIT 1;

