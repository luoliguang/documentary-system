import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { configService } from '../services/configService.js';
import { 
  getOrderTypeOptions as getOrderTypeOptionsHelper, 
  getOrderStatusOptions as getOrderStatusOptionsHelper, 
  getRoleOptions as getRoleOptionsHelper 
} from '../utils/configHelpers.js';

// 获取所有配置（仅管理员）
export const getConfigs = async (req: AuthRequest, res: Response) => {
  try {
    const configs = await configService.getAllConfigs();
    res.json({ configs });
  } catch (error) {
    console.error('获取配置列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取指定配置
export const getConfigByKey = async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const config = await configService.getConfig(key);
    
    if (config === null) {
      return res.status(404).json({ error: '配置不存在' });
    }
    
    res.json({ config });
  } catch (error) {
    console.error('获取配置错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 创建配置
export const createConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { config_key, config_value, description } = req.body;
    
    if (!config_key || config_value === undefined) {
      return res.status(400).json({ error: '配置键和配置值不能为空' });
    }
    
    await configService.setConfig(config_key, config_value, description);
    res.status(201).json({ message: '配置创建成功' });
  } catch (error: any) {
    console.error('创建配置错误:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: '配置键已存在' });
    }
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 更新配置
export const updateConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { config_value, description } = req.body;
    
    if (config_value === undefined) {
      return res.status(400).json({ error: '配置值不能为空' });
    }
    
    await configService.setConfig(key, config_value, description);
    res.json({ message: '配置更新成功' });
  } catch (error: any) {
    console.error('更新配置错误:', error);
    if (error.message && error.message.includes('系统配置表不存在')) {
      return res.status(503).json({ 
        error: '系统配置表不存在，请先执行数据库迁移脚本',
        hint: '请运行: node scripts/run-config-migration.js 或 .\\database\\run-config-migration.ps1'
      });
    }
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 删除配置
export const deleteConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    
    // 不允许删除系统核心配置
    const coreConfigs = ['roles', 'order_types', 'order_statuses', 'role_permissions'];
    if (coreConfigs.includes(key)) {
      return res.status(400).json({ error: '不能删除系统核心配置' });
    }
    
    await configService.deleteConfig(key);
    res.json({ message: '配置删除成功' });
  } catch (error) {
    console.error('删除配置错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取订单类型选项（公开接口，不需要管理员权限）
export const getOrderTypeOptions = async (req: AuthRequest, res: Response) => {
  try {
    const options = await getOrderTypeOptionsHelper();
    res.json({ orderTypes: options });
  } catch (error) {
    console.error('获取订单类型选项错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取订单状态选项（公开接口，不需要管理员权限）
export const getOrderStatusOptions = async (req: AuthRequest, res: Response) => {
  try {
    const options = await getOrderStatusOptionsHelper();
    res.json({ orderStatuses: options });
  } catch (error) {
    console.error('获取订单状态选项错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取角色选项（仅管理员）
export const getRoleOptions = async (req: AuthRequest, res: Response) => {
  try {
    const options = await getRoleOptionsHelper();
    res.json({ roles: options });
  } catch (error) {
    console.error('获取角色选项错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

