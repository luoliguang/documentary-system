import express from 'express';
import {
  createDeliveryReminder,
  getDeliveryReminders,
  respondToReminder,
  assignReminderToProductionManager,
  updateReminderMessage,
  updateAdminResponse,
  deleteReminder,
  getOrderReminderStats,
} from '../controllers/reminderController.js';
import {
  authenticateToken,
  requireAdmin,
  requireCustomer,
} from '../middleware/auth.js';

const router = express.Router();

// 所有催货路由都需要认证
router.use(authenticateToken);

// 客户可以创建催货记录
router.post('/', requireCustomer, createDeliveryReminder);

// 获取催货记录（管理员、生产跟单和客户都可以访问，但返回结果不同）
router.get('/', getDeliveryReminders);

// 获取订单的催货统计信息（客户）
router.get('/order/:order_id/stats', requireCustomer, getOrderReminderStats);

// 管理员回复催货
router.patch('/:id/respond', requireAdmin, respondToReminder);

// 编辑催货消息（仅创建者）
router.patch('/:id/message', updateReminderMessage);

// 编辑管理员回复（管理员和生产跟单）
router.patch('/:id/admin-response', updateAdminResponse);

// 管理员派送催货任务给生产跟单
router.post('/:id/assign', requireAdmin, assignReminderToProductionManager);

// 删除催货记录（管理员和客户都可以删除，但客户只能删除自己的）
router.delete('/:id', deleteReminder);

export default router;

