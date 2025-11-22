-- Migration: Add customer company multi-user shared orders feature
-- Step 1: Create customer_companies table

-- Set client encoding to UTF-8
SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS customer_companies (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL UNIQUE,
    company_code VARCHAR(50) UNIQUE, -- Company code (optional)
    contact_name VARCHAR(100), -- Primary contact
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    notes TEXT, -- Notes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_customer_companies_company_name ON customer_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_customer_companies_company_code ON customer_companies(company_code);

-- Step 2: Add company_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES customer_companies(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Step 3: Add company_id column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES customer_companies(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id);

-- Update timestamp trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create update trigger for customer_companies table
DROP TRIGGER IF EXISTS update_customer_companies_updated_at ON customer_companies;
CREATE TRIGGER update_customer_companies_updated_at BEFORE UPDATE ON customer_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

