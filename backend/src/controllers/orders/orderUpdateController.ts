/**
 * 订单更新控制器
 * 负责订单更新相关的操作
 */

import { Response } from 'express';
import { pool } from '../../config/database.js';
import { AuthRequest } from '../../middleware/auth.js';
import { canUpdateOrder, canUpdateOrderFieldByRole } from '../../services/permissionService.js';
import { ORDER_STATUS } from '../../constants/orderStatus.js';
import { ORDER_ASSIGNMENT_COLUMNS } from '../../services/orderAssignmentService.js';

/**
 * 更新订单
 */
export const updateOrder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const {
      status,
      is_completed,
      can_ship,
      estimated_ship_date,
      actual_ship_date,
      order_date,
      notes,
      internal_notes,
      order_number,
      customer_order_number,
      customer_id,
      order_type,
      images,
      shipping_tracking_numbers,
    } = req.body;

    const oldOrderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    if (oldOrderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const oldOrder = oldOrderResult.rows[0];

    // 使用权限服务检查更新权限
    const canUpdate = await canUpdateOrder(user.userId, user.role, Number(id));
    if (!canUpdate) {
      return res.status(403).json({ error: '您没有权限更新此订单' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    const disallowedFields: string[] = [];

    // 动态权限检查：根据配置表检查每个字段的更新权限
    if (status !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'status');
      if (canUpdateField) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      } else {
        disallowedFields.push('status');
      }
    }
    
    if (is_completed !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'is_completed');
      if (canUpdateField) {
        updates.push(`is_completed = $${paramIndex++}`);
        values.push(is_completed);
      } else {
        disallowedFields.push('is_completed');
      }
    }
    
    if (can_ship !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'can_ship');
      if (canUpdateField) {
        updates.push(`can_ship = $${paramIndex++}`);
        values.push(can_ship);
      } else {
        disallowedFields.push('can_ship');
      }
    }
    
    if (estimated_ship_date !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'estimated_ship_date');
      if (canUpdateField) {
        updates.push(`estimated_ship_date = $${paramIndex++}`);
        values.push(estimated_ship_date || null);
      } else {
        disallowedFields.push('estimated_ship_date');
      }
    }
    
    if (actual_ship_date !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'actual_ship_date');
      if (canUpdateField) {
        updates.push(`actual_ship_date = $${paramIndex++}`);
        values.push(actual_ship_date || null);
      } else {
        disallowedFields.push('actual_ship_date');
      }
    }
    
    if (notes !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'notes');
      if (canUpdateField) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(notes);
      } else {
        disallowedFields.push('notes');
      }
    }
    
    if (internal_notes !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'internal_notes');
      if (canUpdateField) {
        updates.push(`internal_notes = $${paramIndex++}`);
        values.push(internal_notes);
      } else {
        disallowedFields.push('internal_notes');
      }
    }
    
    if (order_number !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'order_number');
      if (canUpdateField) {
        // 检查订单编号是否已被其他订单使用（排除当前订单）
        const existingOrder = await pool.query(
          'SELECT id FROM orders WHERE order_number = $1 AND id != $2',
          [order_number, id]
        );
        if (existingOrder.rows.length > 0) {
          return res.status(400).json({ error: '工厂订单编号已存在，请使用其他编号' });
        }
        updates.push(`order_number = $${paramIndex++}`);
        values.push(order_number);
      } else {
        disallowedFields.push('order_number');
      }
    }
    
    if (customer_order_number !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'customer_order_number');
      if (canUpdateField) {
        updates.push(`customer_order_number = $${paramIndex++}`);
        values.push(customer_order_number);
      } else {
        disallowedFields.push('customer_order_number');
      }
    }
    
    if (customer_id !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'customer_id');
      if (canUpdateField) {
        // 验证客户是否存在
        const customerResult = await pool.query(
          'SELECT id, customer_code FROM users WHERE id = $1 AND role = $2',
          [customer_id, 'customer']
        );
        if (customerResult.rows.length === 0) {
          return res.status(400).json({ error: '客户不存在' });
        }
        
        // 更新 customer_id 和 customer_code
        updates.push(`customer_id = $${paramIndex++}`);
        values.push(customer_id);
        updates.push(`customer_code = $${paramIndex++}`);
        values.push(customerResult.rows[0].customer_code);
      } else {
        disallowedFields.push('customer_id');
      }
    }
    
    if (order_type !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'order_type');
      if (canUpdateField) {
        updates.push(`order_type = $${paramIndex++}`);
        values.push(order_type);
      } else {
        disallowedFields.push('order_type');
      }
    }
    
    if (images !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'images');
      if (canUpdateField) {
        updates.push(`images = $${paramIndex++}`);
        values.push(JSON.stringify(images));
      } else {
        disallowedFields.push('images');
      }
    }
    
    if (order_date !== undefined) {
      // 验证下单时间
      if (order_date) {
        const orderDate = new Date(order_date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (orderDate > today) {
          return res.status(400).json({ error: '下单时间不能晚于当前日期' });
        }
      }
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'order_date');
      if (canUpdateField) {
        updates.push(`order_date = $${paramIndex++}`);
        values.push(order_date || null);
      } else {
        disallowedFields.push('order_date');
      }
    }

    if (shipping_tracking_numbers !== undefined) {
      const canUpdateField = await canUpdateOrderFieldByRole(user.role, 'shipping_tracking_numbers');
      if (canUpdateField) {
        updates.push(`shipping_tracking_numbers = $${paramIndex++}`);
        values.push(JSON.stringify(shipping_tracking_numbers));
      } else {
        disallowedFields.push('shipping_tracking_numbers');
      }
    }

    // 如果有不允许更新的字段，返回错误
    if (disallowedFields.length > 0) {
      console.error(`[订单更新] 权限不足: 用户 ${user.userId} (${user.role}) 尝试更新字段: ${disallowedFields.join(', ')}`);
      return res.status(403).json({ 
        error: `您没有权限更新以下字段: ${disallowedFields.join(', ')}。请在系统配置中检查您的权限设置。` 
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(id);
    const updateQuery = `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, values);

    if (status && status !== oldOrder.status) {
      await pool.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, oldOrder.status, status, user.userId, '更新订单状态']
      );
    }

    // 获取完整的订单信息（包含关联的客户信息）
    const fullOrderQuery = `
      SELECT o.*, 
             u.company_name, 
             u.contact_name, 
             u.phone as customer_phone, 
             u.email as customer_email,
             pm.username as assigned_to_name,
             ${ORDER_ASSIGNMENT_COLUMNS}
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN users pm ON o.assigned_to = pm.id
      WHERE o.id = $1
    `;
    const fullOrderResult = await pool.query(fullOrderQuery, [id]);

    const updatedOrder = fullOrderResult.rows[0];
    
    // 实时推送
    const { emitOrderUpdated } = await import('../../websocket/emitter.js');
    emitOrderUpdated(Number(id), updatedOrder);

    res.json({
      message: '订单更新成功',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('更新订单错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 完成任务（仅管理员）
 */
export const completeOrder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { notes } = req.body;

    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];
    const result = await pool.query(
      `UPDATE orders SET is_completed = true, status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [ORDER_STATUS.COMPLETED, id]
    );

    await pool.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, order.status, ORDER_STATUS.COMPLETED, user.userId, notes || '标记订单为已完成']
    );

    const completedOrder = result.rows[0];
    
    // 实时推送
    const { emitOrderUpdated } = await import('../../websocket/emitter.js');
    emitOrderUpdated(Number(id), completedOrder);

    res.json({
      message: '订单已标记为完成',
      order: completedOrder,
    });
  } catch (error) {
    console.error('完成任务错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 客户提交自己的订单编号
 */
export const updateCustomerOrderNumber = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { customer_order_number } = req.body;

    if (!customer_order_number) {
      return res.status(400).json({ error: '客户订单编号不能为空' });
    }

    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND customer_id = $2',
      [id, user.userId]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    const result = await pool.query(
      `UPDATE orders SET customer_order_number = $1 WHERE id = $2 RETURNING *`,
      [customer_order_number, id]
    );

    const updatedOrder = result.rows[0];
    
    // 实时推送
    const { emitOrderUpdated } = await import('../../websocket/emitter.js');
    emitOrderUpdated(Number(id), updatedOrder);

    res.json({
      message: '客户订单编号更新成功',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('更新客户订单编号错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

