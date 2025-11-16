import express from 'express';
import { 
  getConfigs, 
  getConfigByKey, 
  createConfig, 
  updateConfig, 
  deleteConfig,
  getOrderTypeOptions,
  getOrderStatusOptions,
  getRoleOptions,
} from '../controllers/configController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 公开接口：获取选项（需要认证，但不需要管理员权限）
router.get('/options/order-types', authenticateToken, getOrderTypeOptions);
router.get('/options/order-statuses', authenticateToken, getOrderStatusOptions);

// 所有配置管理路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取所有配置
router.get('/', getConfigs);

// 获取指定配置
router.get('/:key', getConfigByKey);

// 获取角色选项（仅管理员）
router.get('/options/roles', getRoleOptions);

// 创建配置
router.post('/', createConfig);

// 更新配置
router.put('/:key', updateConfig);

// 删除配置
router.delete('/:key', deleteConfig);

export default router;

