-- Migration: remove orphan customer companies without users or orders
SET client_encoding TO 'UTF8';

DELETE FROM customer_companies cc
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.company_id = cc.id
)
AND NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.company_id = cc.id
);

