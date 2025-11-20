-- 010_add_permission_overrides_to_users.sql
-- 为 users 表增加 permission_overrides 字段，用于存储用户级权限覆盖

ALTER TABLE users
ADD COLUMN IF NOT EXISTS permission_overrides JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.permission_overrides IS '用户级权限覆盖（JSONB，结构：{ resource: { permissionKey: value } })';

