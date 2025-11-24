import { createClient, type RedisClientType } from 'redis';
import { config } from '../config/env.js';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

class CacheService {
  private client: RedisClientType | null = null;
  private connecting: Promise<void> | null = null;

  private async getClient(): Promise<RedisClientType | null> {
    if (!config.redis.url) {
      return null;
    }
    if (this.client?.isOpen) {
      return this.client;
    }
    if (!this.connecting) {
      this.client = createClient({
        url: config.redis.url,
      });
      this.client.on('error', (error) => {
        console.error('Redis连接错误:', error);
      });
      this.connecting = this.client
        .connect()
        .then(() => undefined)
        .catch((error) => {
          console.error('Redis连接失败:', error);
          this.client = null;
        })
        .finally(() => {
          this.connecting = null;
        });
    }
    await this.connecting;
    return this.client && this.client.isOpen ? this.client : null;
  }

  private buildKey(key: string) {
    return `${config.redis.keyPrefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    if (!client) return null;
    return client.get(this.buildKey(key));
  }

  async set(key: string, value: string, ttlSeconds: number = THIRTY_DAYS_SECONDS) {
    const client = await this.getClient();
    if (!client) return;
    if (ttlSeconds > 0) {
      await client.set(this.buildKey(key), value, { EX: ttlSeconds });
    } else {
      await client.set(this.buildKey(key), value);
    }
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: any, ttlSeconds: number = THIRTY_DAYS_SECONDS) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async delete(key: string) {
    const client = await this.getClient();
    if (!client) return;
    await client.del(this.buildKey(key));
  }
}

export const cacheService = new CacheService();


