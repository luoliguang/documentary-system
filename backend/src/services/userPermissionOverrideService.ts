import { pool } from '../config/database.js';
import {
  publishUserPermissionOverrideChanged,
  subscribeUserPermissionOverrideChanged,
  UserPermissionOverrideChangedPayload,
} from '../events/userPermissionEvents.js';

export interface PermissionOverrideMap {
  [resource: string]: Record<string, any>;
}

interface CacheEntry {
  data: PermissionOverrideMap;
  timestamp: number;
}

interface UpdateOptions {
  updatedBy?: number;
  source?: string;
  version?: string;
}

const overrideCache = new Map<number, CacheEntry>();
const OVERRIDE_TTL = 60 * 1000;

function normalizeOverrides(value: any): PermissionOverrideMap {
  if (value && typeof value === 'object') {
    return value as PermissionOverrideMap;
  }
  return {};
}

export async function getUserPermissionOverrides(
  userId: number,
  force = false
): Promise<PermissionOverrideMap> {
  const cached = overrideCache.get(userId);
  if (!force && cached && Date.now() - cached.timestamp < OVERRIDE_TTL) {
    return cached.data;
  }

  try {
    const result = await pool.query(
      'SELECT permission_overrides FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return {};
    }
    const normalized = normalizeOverrides(result.rows[0].permission_overrides);
    overrideCache.set(userId, { data: normalized, timestamp: Date.now() });
    return normalized;
  } catch (error: any) {
    if (error.code !== '42703') {
      console.error('获取用户权限覆盖失败:', error);
    }
    return {};
  }
}

export async function setUserPermissionOverrides(
  userId: number,
  overrides: PermissionOverrideMap,
  options: UpdateOptions = {}
): Promise<void> {
  try {
    await pool.query(
      `
        UPDATE users
        SET permission_overrides = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [userId, JSON.stringify(overrides || {})]
    );
    overrideCache.delete(userId);
    publishUserPermissionOverrideChanged({
      userId,
      overrides,
      updatedBy: options.updatedBy,
      source: options.source,
      version: options.version,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('设置用户权限覆盖失败:', error);
    throw error;
  }
}

export function clearUserPermissionOverrideCache(userId?: number): void {
  if (typeof userId === 'number') {
    overrideCache.delete(userId);
    return;
  }
  overrideCache.clear();
}

subscribeUserPermissionOverrideChanged(
  (payload: UserPermissionOverrideChangedPayload) => {
    clearUserPermissionOverrideCache(payload.userId);
  }
);

