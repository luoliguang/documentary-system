import express from 'express';
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  completeOrder,
  deleteOrder,
  updateCustomerOrderNumber,
  getOrderStatusHistory,
  getCustomers,
  getCustomerCompanies,
  getProductionManagers,
  assignOrderToProductionManager,
} from '../controllers/orders/index.js';
import {
  authenticateToken,
  requireAdmin,
  requireAdminOrSupport,
  requireCustomer,
} from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createOrderSchema,
  updateOrderSchema,
  updateCustomerOrderNumberSchema,
  completeOrderSchema,
  assignOrderSchema,
  getOrdersQuerySchema,
} from '../validators/orderSchemas.js';

const router = express.Router();

// 所有订单路由都需要认证
router.use(authenticateToken);

// 获取订单列表（管理员和客户都可以访问，但返回结果不同）
router.get('/', validateQuery(getOrdersQuerySchema), getOrders);

// 获取所有客户列表（仅管理员）- 必须在 /:id 之前
router.get('/customers/list', requireAdminOrSupport, getCustomers);

// 获取所有客户公司列表（仅管理员）
router.get('/companies/list', requireAdminOrSupport, getCustomerCompanies);

// 获取所有生产跟单列表（管理员、客服和生产跟单都可以访问，但返回数据不同）
router.get('/production-managers/list', getProductionManagers);

// 获取订单状态历史
router.get('/:id/history', getOrderStatusHistory);

// 客户提交自己的订单编号
router.patch(
  '/:id/customer-order-number',
  requireCustomer,
  validateBody(updateCustomerOrderNumberSchema),
  updateCustomerOrderNumber
);

// 以下路由仅管理员可访问
router.post('/', requireAdminOrSupport, validateBody(createOrderSchema), createOrder);
// 更新订单：管理员和生产跟单都可以访问（权限在控制器中检查）
router.put('/:id', validateBody(updateOrderSchema), updateOrder);
router.patch('/:id/complete', requireAdminOrSupport, validateBody(completeOrderSchema), completeOrder);
router.post('/:id/assign', requireAdminOrSupport, validateBody(assignOrderSchema), assignOrderToProductionManager);
router.delete('/:id', requireAdminOrSupport, deleteOrder);

// 获取订单详情（必须在最后，避免匹配到其他路由）
router.get('/:id', getOrderById);

export default router;

