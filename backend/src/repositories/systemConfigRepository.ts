import { pool } from '../config/database.js';

export interface SystemConfigRow {
  id: number;
  config_key: string;
  config_type: string;
  config_value: any;
  description: string | null;
  metadata: Record<string, any> | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertConfigInput {
  key: string;
  type: string;
  value: any;
  description?: string | null;
  metadata?: Record<string, any> | null;
  updatedBy?: number;
}

export async function findConfig(
  key: string,
  type: string
): Promise<SystemConfigRow | null> {
  const result = await pool.query<SystemConfigRow>(
    `SELECT *
     FROM system_configs
     WHERE config_key = $1 AND config_type = $2`,
    [key, type]
  );
  return result.rows[0] || null;
}

export async function listConfigsByType(
  type: string
): Promise<SystemConfigRow[]> {
  const result = await pool.query<SystemConfigRow>(
    `SELECT *
     FROM system_configs
     WHERE config_type = $1
     ORDER BY config_key`,
    [type]
  );
  return result.rows;
}

export async function listAllConfigs(): Promise<SystemConfigRow[]> {
  const result = await pool.query<SystemConfigRow>(
    `SELECT *
     FROM system_configs
     ORDER BY config_type, config_key`
  );
  return result.rows;
}

export async function deleteConfig(
  key: string,
  type: string
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM system_configs WHERE config_key = $1 AND config_type = $2`,
    [key, type]
  );
  return Number(result.rowCount ?? 0);
}

export async function upsertConfig(
  input: UpsertConfigInput
): Promise<SystemConfigRow> {
  const {
    key,
    type,
    value,
    description = null,
    metadata = null,
    updatedBy,
  } = input;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingResult = await client.query<SystemConfigRow>(
      `SELECT * FROM system_configs
       WHERE config_key = $1 AND config_type = $2
       FOR UPDATE`,
      [key, type]
    );
    const existing = existingResult.rows[0];

    const upsertResult = await client.query<SystemConfigRow>(
      `INSERT INTO system_configs (config_key, config_type, config_value, description, metadata)
       VALUES ($1, $2, $3::jsonb, $4, COALESCE($5::jsonb, '{}'::jsonb))
       ON CONFLICT (config_key, config_type) DO UPDATE SET
         config_value = $3::jsonb,
         description = COALESCE($4, system_configs.description),
         metadata = COALESCE($5::jsonb, system_configs.metadata),
         version = system_configs.version + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        key,
        type,
        JSON.stringify(value),
        description,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
    const row = upsertResult.rows[0];

    // row.config_value 和 row.metadata 已经是 JSONB 类型，需要确保正确序列化
    const versionConfigValue = typeof row.config_value === 'string' 
      ? row.config_value 
      : JSON.stringify(row.config_value);
    const versionMetadata = row.metadata 
      ? (typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata))
      : null;

    await client.query(
      `INSERT INTO system_config_versions
        (config_key, config_type, version, config_value, description, metadata, updated_by, diff)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8::jsonb)`,
      [
        row.config_key,
        row.config_type,
        row.version,
        versionConfigValue,
        row.description,
        versionMetadata,
        updatedBy || null,
        JSON.stringify({
          oldValue: existing?.config_value ?? null,
          newValue: row.config_value,
        }),
      ]
    );

    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

