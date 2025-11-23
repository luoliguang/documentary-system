import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createOrderNumberFeedback,
  getOrderNumberFeedbacks,
  resolveOrderNumberFeedback,
  deleteOrderNumberFeedback,
} from '../controllers/orderNumberFeedbackController.js';

const router = Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 创建反馈（客户）
router.post('/', createOrderNumberFeedback);

// 获取反馈列表
router.get('/', getOrderNumberFeedbacks);

// 处理反馈（管理员/客服）
router.patch('/:id/resolve', resolveOrderNumberFeedback);

// 删除反馈
router.delete('/:id', deleteOrderNumberFeedback);

export default router;

