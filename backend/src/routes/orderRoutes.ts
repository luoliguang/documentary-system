import express from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  completeOrder,
  updateCustomerOrderNumber,
  getOrderStatusHistory,
  getCustomers,
} from '../controllers/orderController.js';
import {
  authenticateToken,
  requireAdmin,
  requireCustomer,
} from '../middleware/auth.js';

const router = express.Router();

// 所有订单路由都需要认证
router.use(authenticateToken);

// 获取订单列表（管理员和客户都可以访问，但返回结果不同）
router.get('/', getOrders);

// 获取所有客户列表（仅管理员）- 必须在 /:id 之前
router.get('/customers/list', requireAdmin, getCustomers);

// 获取订单状态历史
router.get('/:id/history', getOrderStatusHistory);

// 客户提交自己的订单编号
router.patch(
  '/:id/customer-order-number',
  requireCustomer,
  updateCustomerOrderNumber
);

// 以下路由仅管理员可访问
router.post('/', requireAdmin, createOrder);
router.put('/:id', requireAdmin, updateOrder);
router.patch('/:id/complete', requireAdmin, completeOrder);

// 获取订单详情（必须在最后，避免匹配到其他路由）
router.get('/:id', getOrderById);

export default router;

