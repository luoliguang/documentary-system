-- 将预计出货日期字段从 DATE 转换为 TIMESTAMP（支持日期+时间）
DO $$ 
BEGIN
  -- 检查字段是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'estimated_ship_date'
  ) THEN
    -- 字段存在，检查类型是否为DATE，如果是则转换为TIMESTAMP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' 
        AND column_name = 'estimated_ship_date' 
        AND data_type = 'date'
    ) THEN
      -- 将DATE类型转换为TIMESTAMP（日期部分保持不变，时间部分为00:00:00）
      ALTER TABLE orders ALTER COLUMN estimated_ship_date TYPE TIMESTAMP USING estimated_ship_date::TIMESTAMP;
      
      -- 更新注释
      COMMENT ON COLUMN orders.estimated_ship_date IS '预计出货日期（日期+时间）';
    END IF;
  END IF;
END $$;

-- 添加索引以优化查询性能（如果不存在）
CREATE INDEX IF NOT EXISTS idx_orders_estimated_ship_date ON orders(estimated_ship_date);

