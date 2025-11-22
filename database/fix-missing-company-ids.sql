-- 修复缺失的 company_id
-- 此脚本用于修复创建用户时没有设置 company_id 的情况

SET client_encoding TO 'UTF8';

-- 步骤1：为所有有 company_name 但没有 company_id 的客户用户关联公司
UPDATE users u
SET company_id = cc.id
FROM customer_companies cc
WHERE u.role = 'customer'
    AND u.company_name IS NOT NULL
    AND u.company_name != ''
    AND u.company_name = cc.company_name
    AND u.company_id IS NULL;

-- 步骤2：为没有 company_name 的客户用户创建个人公司并关联
DO $$
DECLARE
    user_record RECORD;
    new_company_id INTEGER;
    generated_company_name VARCHAR(200);
BEGIN
    FOR user_record IN 
        SELECT id, username, customer_code, company_name, contact_name, email, phone
        FROM users
        WHERE role = 'customer'
            AND company_id IS NULL
            AND (company_name IS NULL OR company_name = '')
    LOOP
        -- Generate company name (prefer customer_code, otherwise use username)
        IF user_record.customer_code IS NOT NULL AND user_record.customer_code != '' THEN
            generated_company_name := user_record.customer_code || '(Personal Customer)';
        ELSE
            generated_company_name := user_record.username || '(Personal Customer)';
        END IF;
        
        -- Create company record
        INSERT INTO customer_companies (company_name, contact_name, email, phone, notes)
        VALUES (
            generated_company_name,
            user_record.contact_name,
            user_record.email,
            user_record.phone,
            'Auto-created by fix script (Personal Customer)'
        )
        ON CONFLICT (company_name) DO NOTHING
        RETURNING id INTO new_company_id;
        
        -- If not inserted due to conflict, query existing company ID
        IF new_company_id IS NULL THEN
            SELECT id INTO new_company_id
            FROM customer_companies
            WHERE company_name = generated_company_name;
        END IF;
        
        -- Update user
        UPDATE users SET company_id = new_company_id WHERE id = user_record.id;
    END LOOP;
END $$;

-- 步骤3：验证修复结果
SELECT 
    'Users without company_id' as check_type,
    COUNT(*) as count
FROM users
WHERE role = 'customer' AND company_id IS NULL;

-- 显示每个公司的用户数量
SELECT 
    cc.id as company_id,
    cc.company_name,
    COUNT(DISTINCT u.id) as user_count,
    STRING_AGG(DISTINCT u.username, ', ' ORDER BY u.username) as usernames
FROM customer_companies cc
LEFT JOIN users u ON cc.id = u.company_id AND u.role = 'customer'
GROUP BY cc.id, cc.company_name
ORDER BY cc.company_name;

