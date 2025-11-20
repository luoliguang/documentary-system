/**
 * 订单创建控制器
 * 负责订单创建相关的操作
 */

import { Response } from 'express';
import { pool } from '../../config/database.js';
import { AuthRequest } from '../../middleware/auth.js';
import { canCreateOrder } from '../../services/permissionService.js';
import { ORDER_STATUS } from '../../constants/orderStatus.js';
import { ORDER_TYPE } from '../../constants/orderType.js';
import { ErrorFactory } from '../../errors/AppError.js';
import { asyncHandler } from '../../errors/errorHandler.js';

/**
 * 创建订单（仅管理员）
 */
export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  // 使用权限服务检查创建权限
  const canCreate = await canCreateOrder(user.role);
  if (!canCreate) {
    throw ErrorFactory.permissionDenied('您没有权限创建订单');
  }

  const {
    order_number,
    customer_id,
    customer_code,
    customer_order_number,
    status = ORDER_STATUS.PENDING,
    order_type = ORDER_TYPE.REQUIRED,
    notes,
    internal_notes,
    estimated_ship_date,
    order_date,
    images,
    shipping_tracking_numbers,
  } = req.body;

  if (!order_number || !customer_id) {
    throw ErrorFactory.badRequest('订单编号和客户ID不能为空');
  }

  // 验证下单时间
  if (order_date) {
    const orderDate = new Date(order_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // 设置为今天的最后一刻
    if (orderDate > today) {
      throw ErrorFactory.invalidOrderDate();
    }
  } else {
    throw ErrorFactory.badRequest('下单时间不能为空');
  }

  const existingOrder = await pool.query(
    'SELECT id FROM orders WHERE order_number = $1',
    [order_number]
  );
  if (existingOrder.rows.length > 0) {
    throw ErrorFactory.orderAlreadyExists(order_number);
  }

  const customer = await pool.query(
    'SELECT id, customer_code FROM users WHERE id = $1 AND role = $2',
    [customer_id, 'customer']
  );
  if (customer.rows.length === 0) {
    throw ErrorFactory.customerNotFound(customer_id);
  }

  const finalCustomerCode = customer_code || customer.rows[0].customer_code;

  const result = await pool.query(
    `INSERT INTO orders (
        order_number, customer_id, customer_code, customer_order_number,
        status, order_type, notes, internal_notes, estimated_ship_date, order_date, images, shipping_tracking_numbers, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      order_number,
      customer_id,
      finalCustomerCode,
      customer_order_number || null,
      status,
      order_type,
      notes || null,
      internal_notes || null,
      estimated_ship_date || null,
      order_date || null,
      images ? JSON.stringify(images) : '[]',
      shipping_tracking_numbers ? JSON.stringify(shipping_tracking_numbers) : '[]',
      user.userId,
    ]
  );

  await pool.query(
    `INSERT INTO order_status_history (order_id, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4)`,
    [result.rows[0].id, status, user.userId, '创建订单']
  );

  res.status(201).json({
    message: '订单创建成功',
    order: result.rows[0],
  });
});

