import express from 'express';
import {
  createOrderFollowUp,
  getOrderFollowUps,
  getFollowUp,
  updateOrderFollowUp,
  deleteOrderFollowUp,
  getMyFollowUpSummary,
} from '../controllers/followUpController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 所有跟进记录路由都需要认证
router.use(authenticateToken);

// 创建跟进记录（仅生产跟单）
router.post('/', createOrderFollowUp);

// 获取订单的跟进记录列表
router.get('/order/:id', getOrderFollowUps);

// 生产跟单查看自己的跟进概览
router.get('/my', getMyFollowUpSummary);

// 获取跟进记录详情
router.get('/:id', getFollowUp);

// 更新跟进记录（仅生产跟单）
router.put('/:id', updateOrderFollowUp);

// 删除跟进记录（仅生产跟单）
router.delete('/:id', deleteOrderFollowUp);

export default router;

