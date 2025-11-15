import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

// 催货（客户功能）
export const createDeliveryReminder = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { order_id, reminder_type = 'normal', message } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: '订单ID不能为空' });
    }

    // 验证订单属于当前客户
    const orderResult = await pool.query(
      'SELECT id FROM orders WHERE id = $1 AND customer_id = $2',
      [order_id, user.userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    // 创建催货记录
    const result = await pool.query(
      `INSERT INTO delivery_reminders (order_id, customer_id, reminder_type, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [order_id, user.userId, reminder_type, message || null]
    );

    res.status(201).json({
      message: '催货申请已提交',
      reminder: result.rows[0],
    });
  } catch (error) {
    console.error('创建催货记录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取催货记录
export const getDeliveryReminders = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;

    let query: string;
    let params: any[];

    if (user.role === 'admin') {
      // 管理员查看所有催货记录
      const { order_id, is_resolved, page = 1, pageSize = 20 } = req.query;
      let whereConditions: string[] = [];
      params = [];
      let paramIndex = 1;

      if (order_id) {
        whereConditions.push(`dr.order_id = $${paramIndex++}`);
        params.push(order_id);
      }

      if (is_resolved !== undefined) {
        whereConditions.push(`dr.is_resolved = $${paramIndex++}`);
        params.push(is_resolved === 'true');
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      const offset = (Number(page) - 1) * Number(pageSize);
      params.push(Number(pageSize), offset);

      query = `
        SELECT 
          dr.*,
          o.order_number,
          o.customer_code,
          u.company_name,
          u.contact_name
        FROM delivery_reminders dr
        LEFT JOIN orders o ON dr.order_id = o.id
        LEFT JOIN users u ON dr.customer_id = u.id
        ${whereClause}
        ORDER BY dr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
    } else {
      // 客户只能查看自己的催货记录
      query = `
        SELECT 
          dr.*,
          o.order_number
        FROM delivery_reminders dr
        LEFT JOIN orders o ON dr.order_id = o.id
        WHERE dr.customer_id = $1
        ORDER BY dr.created_at DESC
      `;
      params = [user.userId];
    }

    const result = await pool.query(query, params);
    res.json({ reminders: result.rows });
  } catch (error) {
    console.error('获取催货记录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 管理员回复催货（仅管理员）
export const respondToReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { admin_response, is_resolved = true } = req.body;

    // 检查催货记录是否存在
    const reminderResult = await pool.query(
      'SELECT * FROM delivery_reminders WHERE id = $1',
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    // 更新催货记录
    const result = await pool.query(
      `UPDATE delivery_reminders
       SET admin_response = $1, is_resolved = $2, resolved_at = $3
       WHERE id = $4
       RETURNING *`,
      [
        admin_response || null,
        is_resolved,
        is_resolved ? new Date() : null,
        id,
      ]
    );

    res.json({
      message: '回复成功',
      reminder: result.rows[0],
    });
  } catch (error) {
    console.error('回复催货错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

