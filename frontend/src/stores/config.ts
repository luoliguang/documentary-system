import { defineStore } from 'pinia';
import { ref } from 'vue';
import { configsApi } from '../api/configs';
import type { ConfigMeta } from '../api/configs';

type CacheKey = string;

const buildCacheKey = (key: string, type?: string) =>
  `${type || 'general'}:${key}`;

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

  const isLoading = (key: string, type?: string) =>
    Boolean(loading.value[buildCacheKey(key, type)]);

  const getConfigValue = <T = any>(key: string, type?: string): T | undefined =>
    values.value[buildCacheKey(key, type)];

  const getMeta = (key: string, type?: string) =>
    meta.value[buildCacheKey(key, type)];

  const fetchConfig = async (key: string, options: FetchOptions = {}) => {
    const cacheKey = buildCacheKey(key, options.type);
    if (!options.force && values.value[cacheKey] !== undefined) {
      return values.value[cacheKey];
    }
    loading.value[cacheKey] = true;
    try {
      const response = (await configsApi.getConfigByKey(key, {
        type: options.type,
      })) as { config?: any; meta?: ConfigMeta | null };
      values.value[cacheKey] = response.config ?? null;
      meta.value[cacheKey] = response.meta ?? null;
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
      return;
    }
    const cacheKey = buildCacheKey(key, type);
    delete values.value[cacheKey];
    delete meta.value[cacheKey];
    delete loading.value[cacheKey];
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


