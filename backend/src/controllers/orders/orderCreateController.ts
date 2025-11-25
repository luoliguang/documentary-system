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
import { addOrderActivity } from '../../services/activityService.js';
import { getCustomerRoleValues } from '../../utils/configHelpers.js';

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

  const customerRoles = await getCustomerRoleValues();
  const customer = await pool.query(
    'SELECT id, customer_code, company_id, company_name FROM users WHERE id = $1 AND role = ANY($2)',
    [customer_id, customerRoles]
  );
  if (customer.rows.length === 0) {
    throw ErrorFactory.customerNotFound(customer_id);
  }

  const finalCustomerCode = customer_code || customer.rows[0].customer_code;
  let finalCompanyId = customer.rows[0].company_id;

  // 如果客户没有关联公司，尝试通过 company_name 查找或创建
  if (!finalCompanyId) {
    const customerCompanyName = customer.rows[0].company_name;
    if (customerCompanyName) {
      // 查找或创建公司
      let companyResult = await pool.query(
        'SELECT id FROM customer_companies WHERE company_name = $1',
        [customerCompanyName]
      );
      if (companyResult.rows.length === 0) {
        // 创建新公司
        companyResult = await pool.query(
          `INSERT INTO customer_companies (company_name, notes)
           VALUES ($1, '由订单创建自动生成') RETURNING id`,
          [customerCompanyName]
        );
      }
      finalCompanyId = companyResult.rows[0].id;
      
      // 更新用户的 company_id
      await pool.query(
        'UPDATE users SET company_id = $1 WHERE id = $2',
        [finalCompanyId, customer_id]
      );
    } else {
      // 如果没有公司名，创建一个基于客户编号或用户名的公司
      const generatedCompanyName = finalCustomerCode 
        ? `${finalCustomerCode}（个人客户）`
        : `客户${customer_id}（个人客户）`;
      
      let companyResult = await pool.query(
        'SELECT id FROM customer_companies WHERE company_name = $1',
        [generatedCompanyName]
      );
      if (companyResult.rows.length === 0) {
        companyResult = await pool.query(
          `INSERT INTO customer_companies (company_name, notes)
           VALUES ($1, '由订单创建自动生成（个人客户）') RETURNING id`,
          [generatedCompanyName]
        );
      }
      finalCompanyId = companyResult.rows[0].id;
      
      // 更新用户的 company_id
      await pool.query(
        'UPDATE users SET company_id = $1 WHERE id = $2',
        [finalCompanyId, customer_id]
      );
    }
  }

  const result = await pool.query(
    `INSERT INTO orders (
        order_number, customer_id, customer_code, customer_order_number,
        status, order_type, notes, internal_notes, estimated_ship_date, order_date, 
        images, shipping_tracking_numbers, company_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
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
      finalCompanyId,
      user.userId,
    ]
  );

  await pool.query(
    `INSERT INTO order_status_history (order_id, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4)`,
    [result.rows[0].id, status, user.userId, '创建订单']
  );

  // 记录操作日志
  const customerInfo = customer.rows[0];
  await addOrderActivity({
    orderId: result.rows[0].id,
    userId: user.userId,
    actionType: 'created',
    actionText: `创建订单 ${order_number}`,
    extraData: {
      order_number,
      customer_id: customer_id,
      customer_name: customerInfo.company_name || '未知客户',
      status,
      order_type,
    },
    isVisibleToCustomer: false,
  });

  res.status(201).json({
    message: '订单创建成功',
    order: result.rows[0],
  });
});

