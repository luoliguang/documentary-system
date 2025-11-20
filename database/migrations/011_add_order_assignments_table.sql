-- 011_add_order_assignments_table.sql
-- 引入订单与生产跟单的多对多分配关系

CREATE TABLE IF NOT EXISTS order_assignments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  production_manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_assignments_order_pm
  ON order_assignments(order_id, production_manager_id);

CREATE INDEX IF NOT EXISTS idx_order_assignments_order_id
  ON order_assignments(order_id);

CREATE INDEX IF NOT EXISTS idx_order_assignments_pm_id
  ON order_assignments(production_manager_id);

-- 迁移历史数据：将 orders.assigned_to 中已有的生产跟单写入关系表
INSERT INTO order_assignments (order_id, production_manager_id, assigned_by)
SELECT o.id, o.assigned_to, NULL
FROM orders o
WHERE o.assigned_to IS NOT NULL
ON CONFLICT (order_id, production_manager_id) DO NOTHING;

