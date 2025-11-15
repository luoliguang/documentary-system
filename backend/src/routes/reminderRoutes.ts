import express from 'express';
import {
  createDeliveryReminder,
  getDeliveryReminders,
  respondToReminder,
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

// 获取催货记录（管理员和客户都可以访问，但返回结果不同）
router.get('/', getDeliveryReminders);

// 管理员回复催货
router.patch('/:id/respond', requireAdmin, respondToReminder);

export default router;

