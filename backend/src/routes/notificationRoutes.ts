import express from 'express';
import {
  getUnreadNotificationCount,
  getNotificationList,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById,
  deleteNotificationsBatch,
  markOrderNotificationsAsReadController,
} from '../controllers/notificationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 所有通知路由都需要认证
router.use(authenticateToken);

// 获取未读通知数量
router.get('/unread-count', getUnreadNotificationCount);

// 获取通知列表
router.get('/', getNotificationList);

// 按订单标记通知为已读（需要放在 /:id 路由之前）
router.patch('/order/:orderId/read', markOrderNotificationsAsReadController);

// 标记所有通知为已读（必须在 /:id 路由之前）
router.patch('/read-all', markAllNotificationsAsRead);

// 批量删除通知（必须在 /:id 路由之前）
router.delete('/batch', deleteNotificationsBatch);

// 标记通知为已读
router.patch('/:id/read', markNotificationAsRead);

// 删除通知
router.delete('/:id', deleteNotificationById);

export default router;

