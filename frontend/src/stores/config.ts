import { defineStore } from 'pinia';
import { ref } from 'vue';
import { configsApi } from '../api/configs';
import type { ConfigMeta } from '../api/configs';
import { cache } from '../utils/cache';
import { CONFIG_KEYS } from '../constants/configKeys';

type CacheKey = string;

const buildCacheKey = (key: string, type?: string) =>
  `${type || 'general'}:${key}`;

const PERSISTED_KEYS = new Set<string>([
  CONFIG_KEYS.ORDER_STATUSES,
  CONFIG_KEYS.ORDER_TYPES,
  CONFIG_KEYS.ROLES,
  CONFIG_KEYS.CUSTOMER_ROLES,
]);

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const hasOwn = (target: Record<string, any>, key: string) =>
  Object.prototype.hasOwnProperty.call(target, key);

interface FetchOptions {
  type?: string;
  force?: boolean;
}

interface SaveOptions {
  type?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export const useConfigStore = defineStore('config-store', () => {
  const values = ref<Record<CacheKey, any>>({});
  const meta = ref<Record<CacheKey, any>>({});
  const loading = ref<Record<CacheKey, boolean>>({});

  const restoreFromCache = (cacheKey: string) => {
    const cached = cache.get<any>(`config:${cacheKey}`);
    if (cached !== undefined) {
      values.value[cacheKey] = cached;
      return cached;
    }
    return undefined;
  };

  const isLoading = (key: string, type?: string) =>
    Boolean(loading.value[buildCacheKey(key, type)]);

  const getConfigValue = <T = any>(key: string, type?: string): T | undefined =>
    values.value[buildCacheKey(key, type)];

  const getMeta = (key: string, type?: string) =>
    meta.value[buildCacheKey(key, type)];

  const fetchConfig = async (key: string, options: FetchOptions = {}) => {
    const cacheKey = buildCacheKey(key, options.type);
    if (!options.force) {
      if (hasOwn(values.value, cacheKey)) {
        return values.value[cacheKey];
      }
      const restored = restoreFromCache(cacheKey);
      if (restored !== undefined) {
        return restored;
      }
    }
    loading.value[cacheKey] = true;
    try {
      const response = (await configsApi.getConfigByKey(key, {
        type: options.type,
      })) as { config?: any; meta?: ConfigMeta | null };
      values.value[cacheKey] = response.config ?? null;
      meta.value[cacheKey] = response.meta ?? null;
      if (PERSISTED_KEYS.has(key)) {
        cache.set(`config:${cacheKey}`, values.value[cacheKey], {
          ttl: THIRTY_DAYS,
          persistent: true,
        });
      }
      return values.value[cacheKey];
    } finally {
      loading.value[cacheKey] = false;
    }
  };

  const saveConfig = async (
    key: string,
    value: any,
    options: SaveOptions = {}
  ) => {
    await configsApi.updateConfig(key, {
      config_value: value,
      description: options.description,
      type: options.type,
      metadata: options.metadata,
    });
    await fetchConfig(key, { type: options.type, force: true });
  };

  const invalidate = (key?: string, type?: string) => {
    if (!key) {
      values.value = {};
      meta.value = {};
      loading.value = {};
      cache.clear();
      return;
    }
    const cacheKey = buildCacheKey(key, type);
    delete values.value[cacheKey];
    delete meta.value[cacheKey];
    delete loading.value[cacheKey];
    cache.delete(`config:${cacheKey}`);
  };

  return {
    isLoading,
    getConfigValue,
    getMeta,
    fetchConfig,
    saveConfig,
    invalidate,
  };
});


