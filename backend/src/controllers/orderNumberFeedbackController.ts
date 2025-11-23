import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { createNotificationsForUsers, getAllAdminUserIds } from '../services/notificationService.js';

// 创建订单编号反馈
export const createOrderNumberFeedback = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { customer_order_number, message } = req.body;

    if (!customer_order_number || !customer_order_number.trim()) {
      return res.status(400).json({ error: '客户订单编号不能为空' });
    }

    // 检查客户角色
    if (user.role !== 'customer') {
      return res.status(403).json({ error: '只有客户可以提交反馈' });
    }

    // 获取客户信息
    const userResult = await pool.query(
      `SELECT username, company_name FROM users WHERE id = $1`,
      [user.userId]
    );
    const customerInfo = userResult.rows[0];

    // 插入反馈记录
    const result = await pool.query(
      `INSERT INTO order_number_feedbacks 
       (customer_id, customer_order_number, message, status, created_at)
       VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
       RETURNING *`,
      [user.userId, customer_order_number.trim(), message?.trim() || null]
    );

    const feedback = result.rows[0];

    // 通知管理员和客服
    const adminUserIds = await getAllAdminUserIds();
    if (adminUserIds.length > 0) {
      await createNotificationsForUsers(
        adminUserIds,
        {
          title: '新的订单编号反馈',
          content: `客户 ${customerInfo?.company_name || customerInfo?.username || '未知'} 提交了订单编号反馈：${customer_order_number}`,
          type: 'reminder', // 使用现有的通知类型
        }
      );
    }

    res.status(201).json({
      message: '反馈已提交，我们会尽快处理',
      feedback,
    });
  } catch (error) {
    console.error('创建订单编号反馈错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取订单编号反馈列表
export const getOrderNumberFeedbacks = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const {
      page = 1,
      pageSize = 20,
      status,
      customer_id,
      customer_order_number,
      customer_company_name,
      start_date,
      end_date,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * pageSizeNum;

    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // 权限控制：客户只能看自己的，管理员/客服可以看全部
    if (user.role === 'customer') {
      whereConditions.push(`onf.customer_id = $${paramIndex++}`);
      params.push(user.userId);
    } else if (customer_id) {
      whereConditions.push(`onf.customer_id = $${paramIndex++}`);
      params.push(customer_id);
    }

    // 软删除过滤
    whereConditions.push(`onf.deleted_at IS NULL`);

    // 状态筛选
    if (status) {
      whereConditions.push(`onf.status = $${paramIndex++}`);
      params.push(status);
    }

    // 客户订单编号筛选
    if (customer_order_number) {
      whereConditions.push(`onf.customer_order_number ILIKE $${paramIndex++}`);
      params.push(`%${customer_order_number}%`);
    }

    // 客户公司筛选
    if (customer_company_name) {
      whereConditions.push(`u.company_name ILIKE $${paramIndex++}`);
      params.push(`%${customer_company_name}%`);
    }

    // 时间范围筛选
    if (start_date) {
      whereConditions.push(`onf.created_at >= $${paramIndex++}`);
      params.push(start_date);
    }
    if (end_date) {
      whereConditions.push(`onf.created_at <= $${paramIndex++}::date + INTERVAL '1 day'`);
      params.push(end_date);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // 构建 JOIN 子句（如果需要筛选客户公司，需要 JOIN users 表）
    const joinClause = customer_company_name
      ? `LEFT JOIN users u ON onf.customer_id = u.id`
      : '';

    // 查询总数
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM order_number_feedbacks onf
       ${joinClause}
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // 查询列表
    const result = await pool.query(
      `SELECT 
        onf.id,
        onf.customer_id,
        onf.customer_order_number,
        onf.message,
        onf.status,
        onf.created_at,
        onf.resolved_at,
        onf.resolved_by,
        onf.resolution_note,
        onf.related_order_id,
        u.username as customer_username,
        u.company_name as customer_company_name,
        resolver.username as resolver_username,
        o.order_number as related_order_number
       FROM order_number_feedbacks onf
       LEFT JOIN users u ON onf.customer_id = u.id
       LEFT JOIN users resolver ON onf.resolved_by = resolver.id
       LEFT JOIN orders o ON onf.related_order_id = o.id
       ${whereClause}
       ORDER BY onf.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSizeNum, offset]
    );

    res.json({
      feedbacks: result.rows,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    console.error('获取订单编号反馈列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 处理订单编号反馈
export const resolveOrderNumberFeedback = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { status, resolution_note, related_order_id } = req.body;

    // 权限检查：只有管理员和客服可以处理
    if (user.role !== 'admin' && user.role !== 'customer_service') {
      return res.status(403).json({ error: '无权处理反馈' });
    }

    // 检查反馈是否存在
    const feedbackResult = await pool.query(
      `SELECT * FROM order_number_feedbacks WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: '反馈不存在' });
    }

    const feedback = feedbackResult.rows[0];

    // 更新反馈
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (status) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (status === 'resolved' && !feedback.resolved_at) {
      updateFields.push(`resolved_at = CURRENT_TIMESTAMP`);
      updateFields.push(`resolved_by = $${paramIndex++}`);
      updateValues.push(user.userId);
    }

    if (resolution_note !== undefined) {
      updateFields.push(`resolution_note = $${paramIndex++}`);
      updateValues.push(resolution_note || null);
    }

    if (related_order_id !== undefined) {
      updateFields.push(`related_order_id = $${paramIndex++}`);
      updateValues.push(related_order_id || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updateValues.push(id);
    const updateQuery = `
      UPDATE order_number_feedbacks
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);
    const updatedFeedback = result.rows[0];

    // 通知客户（如果已处理）
    if (status === 'resolved' && feedback.status === 'pending') {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          feedback.customer_id,
          'order_feedback',
          '订单编号反馈已处理',
          `您的订单编号反馈"${feedback.customer_order_number}"已被处理`,
          feedback.id,
          'order_feedback',
        ]
      );
    }

    res.json({
      message: '反馈已更新',
      feedback: updatedFeedback,
    });
  } catch (error) {
    console.error('处理订单编号反馈错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 删除订单编号反馈
export const deleteOrderNumberFeedback = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // 检查反馈是否存在
    const feedbackResult = await pool.query(
      `SELECT * FROM order_number_feedbacks WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: '反馈不存在' });
    }

    const feedback = feedbackResult.rows[0];

    // 权限检查：客户只能删自己的，管理员可以删全部
    if (user.role === 'customer' && feedback.customer_id !== user.userId) {
      return res.status(403).json({ error: '无权删除此反馈' });
    }

    if (user.role !== 'admin' && user.role !== 'customer' && user.role !== 'customer_service') {
      return res.status(403).json({ error: '无权删除反馈' });
    }

    // 软删除
    await pool.query(
      `UPDATE order_number_feedbacks
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({ message: '反馈已删除' });
  } catch (error) {
    console.error('删除订单编号反馈错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

