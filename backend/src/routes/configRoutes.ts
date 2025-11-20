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
  getRolePermissionsConfig,
} from '../controllers/configController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 公开接口：获取选项（需要认证，但不需要管理员权限）
router.get('/options/order-types', authenticateToken, getOrderTypeOptions);
router.get('/options/order-statuses', authenticateToken, getOrderStatusOptions);

router.use(authenticateToken);

router.get('/options/roles', getRoleOptions);
router.get('/role-permissions', getRolePermissionsConfig);
router.get('/', getConfigs);
router.post('/', createConfig);
router.put('/:key', updateConfig);
router.delete('/:key', deleteConfig);
router.get('/:key', getConfigByKey);

export default router;

