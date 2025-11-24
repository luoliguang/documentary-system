import type { PiniaPluginContext } from 'pinia';

type PersistOption =
  | boolean
  | {
      key?: string;
      storage?: Storage;
      paths?: string[];
      ttl?: number;
    }
  | Array<{
      key?: string;
      storage?: Storage;
      paths?: string[];
      ttl?: number;
    }>;

declare module 'pinia' {
  interface DefineStoreOptionsBase<S, Store> {
    persist?: PersistOption;
  }
}

const DEFAULT_STORAGE =
  typeof window !== 'undefined' ? window.localStorage : undefined;

const resolveStrategies = (
  persist?: PersistOption
): Array<NonNullable<Exclude<PersistOption, boolean | Array<any>>>> => {
  if (!persist) return [];
  if (persist === true) return [{}];
  if (Array.isArray(persist)) return persist;
  return [persist];
};

const getValueByPath = (target: any, path: string) => {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), target);
};

const setValueByPath = (target: any, path: string, value: any) => {
  const keys = path.split('.');
  let current = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
      return;
    }
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  });
};

const shouldRestore = (entry: { value: any; expiresAt?: number } | null) => {
  if (!entry) return false;
  if (!entry.expiresAt) return true;
  return Date.now() <= entry.expiresAt;
};

const saveState = (
  storage: Storage | undefined,
  key: string,
  value: Record<string, any>,
  ttl?: number
) => {
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        value,
        expiresAt: ttl ? Date.now() + ttl : undefined,
      })
    );
  } catch (error) {
    console.warn('持久化状态失败:', error);
  }
};

const loadState = (storage: Storage | undefined, key: string) => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    storage.removeItem(key);
    return null;
  }
};

export function persistedStatePlugin() {
  return (context: PiniaPluginContext) => {
    const { options, store } = context;
    const strategies = resolveStrategies(options.persist);
    if (strategies.length === 0) {
      return;
    }

    strategies.forEach((strategy) => {
      const storage = strategy.storage ?? DEFAULT_STORAGE;
      if (!storage) return;
      const key = strategy.key ?? `pinia-${store.$id}`;
      const stored = loadState(storage, key);
      if (stored && shouldRestore(stored)) {
        const payload = stored.value || {};
        if (strategy.paths && strategy.paths.length > 0) {
          strategy.paths.forEach((path) => {
            const value = getValueByPath(payload, path);
            if (value !== undefined) {
              setValueByPath(store, path, value);
            }
          });
        } else {
          store.$patch(payload);
        }
      } else if (stored) {
        storage.removeItem(key);
      }

      store.$subscribe(
        (_, state) => {
          const dataToSave =
            strategy.paths && strategy.paths.length > 0
              ? strategy.paths.reduce((acc, path) => {
                  setValueByPath(acc, path, getValueByPath(state, path));
                  return acc;
                }, {} as Record<string, any>)
              : state;
          saveState(storage, key, dataToSave, strategy.ttl);
        },
        { detached: true }
      );
    });
  };
}


