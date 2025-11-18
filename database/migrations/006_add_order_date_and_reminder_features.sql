-- 添加订单下单时间字段（支持日期+时间）
DO $$ 
BEGIN
  -- 检查字段是否存在
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'order_date'
  ) THEN
    -- 字段不存在，直接创建为TIMESTAMP类型
    ALTER TABLE orders ADD COLUMN order_date TIMESTAMP;
  ELSE
    -- 字段已存在，检查类型是否为DATE，如果是则转换为TIMESTAMP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' 
        AND column_name = 'order_date' 
        AND data_type = 'date'
    ) THEN
      -- 将DATE类型转换为TIMESTAMP（日期部分保持不变，时间部分为00:00:00）
      ALTER TABLE orders ALTER COLUMN order_date TYPE TIMESTAMP USING order_date::TIMESTAMP;
    END IF;
  END IF;
END $$;

-- 添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

-- 添加注释
COMMENT ON COLUMN orders.order_date IS '客户下单时间（日期+时间）';

