import { pool } from '../config/database.js';

interface CacheItem {
  data: any;
  timestamp: number;
}

class ConfigService {
  private cache: Map<string, CacheItem> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 检查表是否存在
   */
  private async checkTableExists(): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'system_configs'
        )`
      );
      return result.rows[0].exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取配置
   */
  async getConfig(key: string): Promise<any> {
    // 检查缓存
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    // 检查表是否存在
    const tableExists = await this.checkTableExists();
    if (!tableExists) {
      // 表不存在，返回默认配置
      const defaultConfig = this.getDefaultConfig(key);
      if (defaultConfig !== null) {
        this.cache.set(key, { data: defaultConfig, timestamp: Date.now() });
      }
      return defaultConfig;
    }

    // 从数据库加载
    try {
      const result = await pool.query(
        'SELECT config_value FROM system_configs WHERE config_key = $1',
        [key]
      );

      if (result.rows.length === 0) {
        // 如果数据库中没有，返回默认配置
        const defaultConfig = this.getDefaultConfig(key);
        if (defaultConfig !== null) {
          this.cache.set(key, { data: defaultConfig, timestamp: Date.now() });
        }
        return defaultConfig;
      }

      const data = result.rows[0].config_value;
      this.cache.set(key, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`获取配置 ${key} 错误:`, error);
      // 如果数据库查询失败，尝试返回默认配置
      return this.getDefaultConfig(key);
    }
  }

  /**
   * 设置配置
   */
  async setConfig(key: string, value: any, description?: string): Promise<void> {
    // 检查表是否存在
    const tableExists = await this.checkTableExists();
    if (!tableExists) {
      throw new Error('系统配置表不存在，请先执行数据库迁移脚本');
    }

    try {
      await pool.query(
        `INSERT INTO system_configs (config_key, config_value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (config_key) 
         DO UPDATE SET config_value = $2, description = COALESCE($3, system_configs.description), updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value), description || null]
      );
      this.invalidateCache(key);
    } catch (error) {
      console.error(`设置配置 ${key} 错误:`, error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<void> {
    // 检查表是否存在
    const tableExists = await this.checkTableExists();
    if (!tableExists) {
      throw new Error('系统配置表不存在，请先执行数据库迁移脚本');
    }

    try {
      await pool.query('DELETE FROM system_configs WHERE config_key = $1', [key]);
      this.invalidateCache(key);
    } catch (error) {
      console.error(`删除配置 ${key} 错误:`, error);
      throw error;
    }
  }

  /**
   * 获取所有配置
   */
  async getAllConfigs(): Promise<any[]> {
    // 检查表是否存在
    const tableExists = await this.checkTableExists();
    if (!tableExists) {
      return [];
    }

    try {
      const result = await pool.query(
        'SELECT id, config_key, config_value, description, created_at, updated_at FROM system_configs ORDER BY config_key'
      );
      return result.rows;
    } catch (error) {
      console.error('获取所有配置错误:', error);
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 获取默认配置（用于向后兼容）
   */
  private getDefaultConfig(key: string): any {
    const defaults: Record<string, any> = {
      roles: [
        { value: 'admin', label: '管理员' },
        { value: 'production_manager', label: '生产跟单' },
        { value: 'customer', label: '客户' },
      ],
      order_types: [
        { value: 'required', label: '必发' },
        { value: 'scattered', label: '散单' },
        { value: 'photo', label: '拍照' },
      ],
      order_statuses: [
        { value: 'pending', label: '待处理' },
        { value: 'in_production', label: '生产中' },
        { value: 'completed', label: '已完成' },
        { value: 'shipped', label: '已发货' },
        { value: 'cancelled', label: '已取消' },
      ],
    };
    return defaults[key] || null;
  }
}

export const configService = new ConfigService();

