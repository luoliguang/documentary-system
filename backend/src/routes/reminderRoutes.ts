import express from 'express';
import {
  createDeliveryReminder,
  getDeliveryReminders,
  respondToReminder,
  assignReminderToProductionManager,
  transferReminderToProductionManager,
  requestReminderTransferPermission,
  updateReminderMessage,
  updateAdminResponse,
  deleteReminder,
  getOrderReminderStats,
} from '../controllers/reminderController.js';
import {
  authenticateToken,
  requireAdmin,
  requireAdminOrSupport,
  requireCustomer,
} from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  createReminderSchema,
  respondReminderSchema,
  requestPermissionSchema,
} from '../validators/reminderSchemas.js';

const router = express.Router();

// 所有催货路由都需要认证
router.use(authenticateToken);

// 客户可以创建催货记录
router.post('/', requireCustomer, validateBody(createReminderSchema), createDeliveryReminder);

// 获取订单的催货统计信息（客户）- 必须在 '/' 路由之前，避免被匹配
router.get('/order/:order_id/stats', requireCustomer, getOrderReminderStats);

// 获取催货记录（管理员、生产跟单和客户都可以访问，但返回结果不同）
router.get('/', getDeliveryReminders);

// 管理员回复催货
router.patch('/:id/respond', requireAdminOrSupport, validateBody(respondReminderSchema), respondToReminder);

// 编辑催货消息（仅创建者）
router.patch('/:id/message', updateReminderMessage);

// 编辑管理员回复（管理员和生产跟单）
router.patch('/:id/admin-response', updateAdminResponse);

// 管理员派送催货任务给生产跟单
router.post('/:id/assign', requireAdminOrSupport, assignReminderToProductionManager);

// 生产跟单转交催货任务给其他生产跟单
router.post('/:id/transfer', transferReminderToProductionManager);

// 生产跟单为目标生产跟单申请权限
router.post(
  '/:id/request-permission',
  validateBody(requestPermissionSchema),
  requestReminderTransferPermission
);

// 删除催货记录（管理员和客户都可以删除，但客户只能删除自己的）
router.delete('/:id', deleteReminder);

export default router;

