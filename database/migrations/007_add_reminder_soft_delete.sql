-- 添加软删除字段
ALTER TABLE delivery_reminders 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- 添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_delivery_reminders_is_deleted 
ON delivery_reminders(is_deleted);

-- 添加注释
COMMENT ON COLUMN delivery_reminders.is_deleted IS '是否已删除（软删除）';
COMMENT ON COLUMN delivery_reminders.deleted_at IS '删除时间';
COMMENT ON COLUMN delivery_reminders.deleted_by IS '删除者ID';

