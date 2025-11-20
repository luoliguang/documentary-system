import {
  deleteConfig as deleteConfigRepo,
  findConfig,
  listAllConfigs,
  listConfigsByType,
  upsertConfig,
} from '../repositories/systemConfigRepository.js';
import type { ConfigScope } from './config/providers/ConfigProvider.js';
import {
  ConfigProviderDescriptor,
  ConfigProvider,
} from './config/providers/ConfigProvider.js';
import { GeneralConfigProvider } from './config/providers/GeneralConfigProvider.js';
import { OrderOptionConfigProvider } from './config/providers/OrderOptionConfigProvider.js';
import { RolePermissionConfigProvider } from './config/providers/RolePermissionConfigProvider.js';
import {
  publishConfigDeleted,
  publishConfigUpdated,
  publishOrderOptionChanged,
  publishRolePermissionChanged,
} from '../events/configEvents.js';

interface CacheItem {
  data: any;
  timestamp: number;
  type: string;
}

interface ConfigUpdateOptions {
  updatedBy?: number;
  source?: string;
  type?: string;
  metadata?: Record<string, any>;
}

export interface ConfigRecord {
  key: string;
  value: any;
  description: string | null;
  updatedAt: string | null;
  type: string;
  version?: number;
  metadata?: Record<string, any> | null;
}

interface ProviderResolution {
  type: string;
  scope: ConfigScope;
  provider: ConfigProvider;
}

const PROVIDERS: ConfigProviderDescriptor[] = [
  { scope: 'permissions', provider: new RolePermissionConfigProvider() },
  { scope: 'order_options', provider: new OrderOptionConfigProvider() },
  { scope: 'general', provider: new GeneralConfigProvider() },
];

class ConfigService {
  private cache: Map<string, CacheItem> = new Map();
  private readonly TTL = 5 * 60 * 1000;

  private getCacheKey(key: string, type: string): string {
    return `${type}:${key}`;
  }

  private resolveProvider(
    key: string,
    explicitType?: string
  ): ProviderResolution {
    if (explicitType) {
      const descriptor = PROVIDERS.find(
        (item) => item.provider.type === explicitType
      );
      if (descriptor) {
        return {
          type: descriptor.provider.type,
          scope: descriptor.scope,
          provider: descriptor.provider,
        };
      }
    }

    const matched = PROVIDERS.find((item) =>
      item.provider.supportsKey(key)
    );
    const descriptor = matched ?? PROVIDERS.find((item) => item.scope === 'general')!;
    return {
      type: descriptor.provider.type,
      scope: descriptor.scope,
      provider: descriptor.provider,
    };
  }

  async getConfig(
    key: string,
    options: { type?: string } = {}
  ): Promise<any> {
    const { type, provider } = this.resolveProvider(key, options.type);
    const cacheKey = this.getCacheKey(key, type);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    const record = await this.findWithFallback(key, type);
    if (!record) {
      const defaultValue = provider.getDefaultValue(key);
      if (defaultValue !== undefined) {
        this.cache.set(cacheKey, { data: defaultValue, timestamp: Date.now(), type });
      }
      return defaultValue ?? null;
    }

    this.cache.set(cacheKey, {
      data: record.config_value,
      timestamp: Date.now(),
      type,
    });
    return record.config_value;
  }

  async getConfigWithMeta(
    key: string,
    options: { type?: string } = {}
  ): Promise<ConfigRecord | null> {
    const { type, provider } = this.resolveProvider(key, options.type);
    const record = await this.findWithFallback(key, type);
    if (!record) {
      const defaultValue = provider.getDefaultValue(key);
      if (defaultValue === undefined) {
        return null;
      }
      return {
        key,
        value: defaultValue,
        description: null,
        updatedAt: null,
        type,
      };
    }
    return {
      key: record.config_key,
      value: record.config_value,
      description: record.description,
      updatedAt: record.updated_at,
      type: record.config_type,
      version: record.version,
      metadata: record.metadata,
    };
  }

  async setConfig(
    key: string,
    value: any,
    description?: string,
    options: ConfigUpdateOptions = {}
  ): Promise<void> {
    const { type, scope, provider } = this.resolveProvider(key, options.type);
    if (provider.validate) {
      await provider.validate(key, value);
    }
    const normalizedValue =
      provider.normalize?.(key, value) ?? value;
    const row = await upsertConfig({
      key,
      type,
      value: normalizedValue,
      description,
      metadata: options.metadata,
      updatedBy: options.updatedBy,
    });
    this.invalidateCache(key, type);
    this.notifyConfigUpdated(
      key,
      row.config_value,
      row.description,
      options,
      row.updated_at,
      row.version,
      type,
      scope
    );
  }

  async deleteConfig(
    key: string,
    options: ConfigUpdateOptions = {}
  ): Promise<void> {
    const { type } = this.resolveProvider(key, options.type);
    const record = await this.findWithFallback(key, type);
    const targetType = record?.config_type ?? type;
    const result = await deleteConfigRepo(key, targetType);
    if (result > 0) {
      this.invalidateCache(key, targetType);
      publishConfigDeleted({
        key,
        deletedBy: options.updatedBy,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAllConfigs(): Promise<ConfigRecord[]> {
    const rows = await listAllConfigs();
    return rows.map((row) => ({
      key: row.config_key,
      value: row.config_value,
      description: row.description,
      updatedAt: row.updated_at,
      type: row.config_type,
      version: row.version,
      metadata: row.metadata,
    }));
  }

  async getConfigsByType(type: string): Promise<ConfigRecord[]> {
    const rows = await listConfigsByType(type);
    return rows.map((row) => ({
      key: row.config_key,
      value: row.config_value,
      description: row.description,
      updatedAt: row.updated_at,
      type: row.config_type,
      version: row.version,
      metadata: row.metadata,
    }));
  }

  invalidateCache(key?: string, type = 'general'): void {
    if (key) {
      this.cache.delete(this.getCacheKey(key, type));
    } else {
      this.cache.clear();
    }
  }

  private async findWithFallback(key: string, type: string) {
    const record = await findConfig(key, type);
    if (!record && type !== 'general') {
      return findConfig(key, 'general');
    }
    return record;
  }

  private notifyConfigUpdated(
    key: string,
    value: any,
    description: string | null = null,
    options: ConfigUpdateOptions = {},
    updatedAt?: string,
    version?: number,
    type: string = 'general',
    scope: ConfigScope = 'general'
  ): void {
    const payload = {
      key,
      type,
      value,
      description,
      updatedBy: options.updatedBy,
      source: options.source,
      timestamp: new Date().toISOString(),
      updatedAt,
      version,
    };
    publishConfigUpdated(payload);
    if (type === 'permissions') {
      publishRolePermissionChanged(payload);
    }
    if (scope === 'order_options') {
      publishOrderOptionChanged(payload);
    }
  }
}

export const configService = new ConfigService();

