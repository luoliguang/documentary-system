-- 014_add_notification_enabled.sql
-- 添加用户通知开关字段

-- 添加 notification_enabled 字段，默认 false
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT false;

-- 添加注释
COMMENT ON COLUMN users.notification_enabled IS '是否启用桌面通知（默认关闭）';

