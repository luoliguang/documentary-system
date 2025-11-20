-- 013_fix_system_configs_unique.sql
-- 调整 system_configs 唯一约束，允许同一 config_key 在不同类型下共存

ALTER TABLE system_configs
  DROP CONSTRAINT IF EXISTS system_configs_config_key_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_system_configs_key_type'
  ) THEN
    CREATE UNIQUE INDEX uq_system_configs_key_type
      ON system_configs (config_key, config_type);
  END IF;
END$$;

