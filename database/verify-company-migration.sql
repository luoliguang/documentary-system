-- 验证客户公司迁移结果
-- 使用方法: psql -h localhost -U postgres -d fangdu_db -f verify-company-migration.sql

SET client_encoding TO 'UTF8';

-- 1. 检查所有客户是否都有 company_id
SELECT 
    'Customers without company_id' as check_type,
    COUNT(*) as count
FROM users
WHERE role = 'customer' AND company_id IS NULL;

-- 2. 检查所有订单是否都有 company_id
SELECT 
    'Orders without company_id' as check_type,
    COUNT(*) as count
FROM orders o
INNER JOIN users u ON o.customer_id = u.id
WHERE u.role = 'customer' AND o.company_id IS NULL;

-- 3. 查看每个公司的用户数量
SELECT 
    cc.id as company_id,
    cc.company_name,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT o.id) as order_count,
    STRING_AGG(DISTINCT u.username, ', ') as usernames,
    STRING_AGG(DISTINCT u.customer_code, ', ') as customer_codes
FROM customer_companies cc
LEFT JOIN users u ON cc.id = u.company_id AND u.role = 'customer'
LEFT JOIN orders o ON cc.id = o.company_id
GROUP BY cc.id, cc.company_name
ORDER BY cc.company_name;

-- 4. 检查是否有相同公司名但不同 company_id 的情况（不应该有）
SELECT 
    u1.company_name,
    u1.company_id as company_id_1,
    u2.company_id as company_id_2,
    COUNT(DISTINCT u1.id) as users_with_id1,
    COUNT(DISTINCT u2.id) as users_with_id2
FROM users u1
INNER JOIN users u2 ON u1.company_name = u2.company_name
WHERE u1.role = 'customer' 
    AND u2.role = 'customer'
    AND u1.company_name IS NOT NULL
    AND u1.company_name != ''
    AND u1.company_id != u2.company_id
GROUP BY u1.company_name, u1.company_id, u2.company_id;

-- 5. 查看所有客户及其公司信息
SELECT 
    u.id,
    u.username,
    u.customer_code,
    u.company_name as user_company_name,
    u.company_id,
    cc.company_name as company_table_name,
    CASE 
        WHEN u.company_id IS NULL THEN '❌ No company_id'
        WHEN cc.id IS NULL THEN '❌ Company not found'
        WHEN u.company_name != cc.company_name THEN '⚠️ Name mismatch'
        ELSE '✅ OK'
    END as status
FROM users u
LEFT JOIN customer_companies cc ON u.company_id = cc.id
WHERE u.role = 'customer'
ORDER BY u.company_name, u.username;

