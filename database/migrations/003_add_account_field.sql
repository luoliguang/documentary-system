-- 添加账号字段（account）用于登录
-- 账号字段：仅允许字母、数字、下划线，用于登录
-- username 字段：保留用于显示名称，可以包含中文

-- 1. 添加 account 字段（允许为空，稍后填充）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account VARCHAR(50);

-- 2. 为现有用户生成 account（基于 username，去除特殊字符）
-- 如果 username 已经是规范的（仅字母数字下划线），直接使用
-- 否则生成一个基于 id 的账号
UPDATE users 
SET account = CASE 
  WHEN username ~ '^[a-zA-Z0-9_]+$' THEN username
  ELSE 'user_' || id::text
END
WHERE account IS NULL;

-- 3. 设置 account 为 NOT NULL 和 UNIQUE
ALTER TABLE users 
ALTER COLUMN account SET NOT NULL;

-- 如果存在重复的 account，需要处理
-- 为重复的 account 添加后缀
DO $$
DECLARE
  dup_account VARCHAR(50);
  dup_id INTEGER;
  counter INTEGER;
BEGIN
  -- 查找所有重复的 account
  FOR dup_account IN 
    SELECT account
    FROM users
    GROUP BY account
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    -- 为每个重复的 account（除了第一个）添加后缀
    FOR dup_id IN 
      SELECT id
      FROM users
      WHERE account = dup_account
      ORDER BY id
      OFFSET 1
    LOOP
      UPDATE users
      SET account = dup_account || '_' || counter
      WHERE id = dup_id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- 4. 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account ON users(account);

-- 5. 添加注释
COMMENT ON COLUMN users.account IS '登录账号，仅允许字母、数字、下划线，用于登录认证';
COMMENT ON COLUMN users.username IS '用户名/显示名称，可以包含中文，用于显示';

