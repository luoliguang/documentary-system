-- Data migration script: Migrate existing data to new structure
-- Note: This script should be run once to backfill company_id for existing data

-- Set client encoding to UTF-8
SET client_encoding TO 'UTF8';

-- Step 1: Create customer_companies records for each unique company_name
-- Only process users with role = 'customer'
INSERT INTO customer_companies (company_name, contact_name, email, phone, notes)
SELECT DISTINCT
    u.company_name,
    MAX(u.contact_name) as contact_name,
    MAX(u.email) as email,
    MAX(u.phone) as phone,
    'Auto-created by migration' as notes
FROM users u
WHERE u.role = 'customer'
    AND u.company_name IS NOT NULL
    AND u.company_name != ''
    AND NOT EXISTS (
        SELECT 1 FROM customer_companies cc WHERE cc.company_name = u.company_name
    )
GROUP BY u.company_name;

-- Step 2: Link customer users in users table to corresponding customer_companies
UPDATE users u
SET company_id = cc.id
FROM customer_companies cc
WHERE u.role = 'customer'
    AND u.company_name IS NOT NULL
    AND u.company_name != ''
    AND u.company_name = cc.company_name
    AND u.company_id IS NULL;

-- Step 3: Link orders in orders table to corresponding customer_companies
-- Find user by customer_id, then link via user's company_id
UPDATE orders o
SET company_id = u.company_id
FROM users u
WHERE o.customer_id = u.id
    AND u.company_id IS NOT NULL
    AND o.company_id IS NULL;

-- Step 4: Handle customer users without company_name
-- Create a separate company record for each customer without company name (use username or customer_code as company name)
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
            'Auto-created by migration (Personal Customer)'
        )
        ON CONFLICT (company_name) DO NOTHING
        RETURNING id INTO new_company_id;
        
            -- If not inserted due to conflict, query existing company ID
        IF new_company_id IS NULL THEN
            SELECT id INTO new_company_id
            FROM customer_companies
            WHERE company_name = generated_company_name;
        END IF;
        
            -- Update user and orders
        UPDATE users SET company_id = new_company_id WHERE id = user_record.id;
        UPDATE orders SET company_id = new_company_id WHERE customer_id = user_record.id AND company_id IS NULL;
    END LOOP;
END $$;

-- Verification: Check if there is any missing data
DO $$
DECLARE
    users_without_company INTEGER;
    orders_without_company INTEGER;
BEGIN
    SELECT COUNT(*) INTO users_without_company
    FROM users
    WHERE role = 'customer' AND company_id IS NULL;
    
    SELECT COUNT(*) INTO orders_without_company
    FROM orders o
    INNER JOIN users u ON o.customer_id = u.id
    WHERE u.role = 'customer' AND o.company_id IS NULL;
    
    IF users_without_company > 0 OR orders_without_company > 0 THEN
        RAISE NOTICE 'Warning: % customer users and % orders are still not linked to companies', users_without_company, orders_without_company;
    ELSE
        RAISE NOTICE 'Migration completed: All customer users and orders are linked to companies';
    END IF;
END $$;

