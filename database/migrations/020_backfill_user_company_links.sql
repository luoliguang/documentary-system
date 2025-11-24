-- Migration: backfill missing user.company_id and order.company_id references
SET client_encoding TO 'UTF8';

-- Step 1: ensure every referenced company exists in customer_companies
WITH normalized_users AS (
  SELECT
    TRIM(u.company_name) AS company_name,
    MAX(u.contact_name) AS contact_name,
    MAX(u.email) AS email,
    MAX(u.phone) AS phone
  FROM users u
  WHERE u.company_name IS NOT NULL
    AND TRIM(u.company_name) <> ''
  GROUP BY TRIM(u.company_name)
)
INSERT INTO customer_companies (company_name, contact_name, email, phone, notes)
SELECT
  nu.company_name,
  nu.contact_name,
  nu.email,
  nu.phone,
  'Auto-created during company backfill'
FROM normalized_users nu
ON CONFLICT (company_name) DO NOTHING;

-- Step 2: sync users.company_id based on company_name
UPDATE users u
SET company_id = cc.id
FROM customer_companies cc
WHERE u.company_name IS NOT NULL
  AND TRIM(u.company_name) <> ''
  AND cc.company_name = TRIM(u.company_name)
  AND (u.company_id IS NULL OR u.company_id <> cc.id);

-- Step 3: sync orders.company_id with their customer
UPDATE orders o
SET company_id = u.company_id
FROM users u
WHERE o.customer_id = u.id
  AND u.company_id IS NOT NULL
  AND (o.company_id IS DISTINCT FROM u.company_id);

