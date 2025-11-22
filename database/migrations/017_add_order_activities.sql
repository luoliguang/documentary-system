-- Migration: Add order activities table for operation logs
-- Step 1: Create order_activities table

-- Set client encoding to UTF-8
SET client_encoding TO 'UTF8';

CREATE TABLE IF NOT EXISTS order_activities (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    action_text TEXT NOT NULL,
    extra_data JSONB DEFAULT '{}'::jsonb,
    is_visible_to_customer BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_activities_order_id ON order_activities(order_id);
CREATE INDEX IF NOT EXISTS idx_order_activities_user_id ON order_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_order_activities_action_type ON order_activities(action_type);
CREATE INDEX IF NOT EXISTS idx_order_activities_created_at ON order_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_order_activities_visible ON order_activities(order_id, is_visible_to_customer);

