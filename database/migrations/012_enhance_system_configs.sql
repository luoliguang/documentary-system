-- 012_enhance_system_configs.sql
-- 扩展 system_configs 结构并新增历史记录表

ALTER TABLE system_configs
  ADD COLUMN IF NOT EXISTS config_type VARCHAR(50) NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'uq_system_configs_key_type'
  ) THEN
    CREATE UNIQUE INDEX uq_system_configs_key_type
      ON system_configs (config_key, config_type);
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS system_config_versions (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  config_type VARCHAR(50) NOT NULL,
  version INTEGER NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_by INTEGER,
  diff JSONB,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_config_versions_key
  ON system_config_versions(config_key, config_type);

