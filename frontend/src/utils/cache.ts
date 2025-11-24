const memoryCache = new Map<
  string,
  {
    value: any;
    expiresAt?: number;
  }
>();

const STORAGE_PREFIX = 'fangdu-cache:';
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30天

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

interface CacheSetOptions {
  ttl?: number;
  persistent?: boolean;
}

const isExpired = (entry?: { expiresAt?: number }) => {
  if (!entry) return true;
  if (!entry.expiresAt) return false;
  return Date.now() > entry.expiresAt;
};

const readFromStorage = (key: string) => {
  const storage = getStorage();
  if (!storage) return undefined;
  const raw = storage.getItem(STORAGE_PREFIX + key);
  if (!raw) return undefined;
  try {
    const data = JSON.parse(raw);
    if (isExpired(data)) {
      storage.removeItem(STORAGE_PREFIX + key);
      return undefined;
    }
    return data.value;
  } catch {
    storage.removeItem(STORAGE_PREFIX + key);
    return undefined;
  }
};

const writeToStorage = (key: string, value: any, ttl: number) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    const expiresAt = ttl > 0 ? Date.now() + ttl : undefined;
    storage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify({
        value,
        expiresAt,
      })
    );
  } catch (error) {
    console.warn('缓存写入失败', error);
  }
};

export const cache = {
  get<T = any>(key: string): T | undefined {
    const existing = memoryCache.get(key);
    if (!isExpired(existing)) {
      return existing?.value;
    }
    memoryCache.delete(key);
    const persisted = readFromStorage(key);
    if (persisted !== undefined) {
      memoryCache.set(key, { value: persisted });
      return persisted;
    }
    return undefined;
  },
  set<T = any>(key: string, value: T, options: CacheSetOptions = {}) {
    const ttl = options.ttl ?? DEFAULT_TTL_MS;
    const expiresAt = ttl > 0 ? Date.now() + ttl : undefined;
    memoryCache.set(key, { value, expiresAt });
    if (options.persistent) {
      writeToStorage(key, value, ttl);
    }
  },
  delete(key: string) {
    memoryCache.delete(key);
    const storage = getStorage();
    storage?.removeItem(STORAGE_PREFIX + key);
  },
  clear() {
    memoryCache.clear();
    const storage = getStorage();
    if (!storage) return;
    Object.keys(storage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => storage.removeItem(k));
  },
  remember<T>(key: string, factory: () => Promise<T> | T, options?: CacheSetOptions): Promise<T> | T {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = factory();
    if (result instanceof Promise) {
      return result.then((resolved) => {
        this.set(key, resolved, options);
        return resolved;
      });
    }
    this.set(key, result, options);
    return result;
  },
};


