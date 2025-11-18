import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  createFollowUp,
  getFollowUpsByOrderId,
  getFollowUpById,
  updateFollowUp,
  deleteFollowUp,
} from '../services/followUpService.js';
import {
  createNotification,
  getAllAdminUserIds,
} from '../services/notificationService.js';

/**
 * 创建跟进记录
 */
export const createOrderFollowUp = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { order_id, content, is_visible_to_customer = true } = req.body;

    if (!order_id || !content) {
      return res.status(400).json({ error: '订单ID和跟进内容不能为空' });
    }

    // 验证用户是否有权限创建跟进记录
    if (user.role !== 'production_manager') {
      return res.status(403).json({ error: '只有生产跟单可以创建跟进记录' });
    }

    // 验证订单是否分配给该生产跟单
    const orderResult = await pool.query(
      'SELECT id, assigned_to FROM orders WHERE id = $1',
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];
    if (order.assigned_to !== user.userId) {
      return res.status(403).json({ error: '您没有权限对此订单创建跟进记录' });
    }

    // 获取订单信息
    const orderInfoResult = await pool.query(
      `SELECT o.order_number, o.customer_id, u.company_name, u.contact_name
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.id
       WHERE o.id = $1`,
      [order_id]
    );
    const orderInfo = orderInfoResult.rows[0];

    // 创建跟进记录
    const followUp = await createFollowUp({
      order_id,
      production_manager_id: user.userId,
      content,
      is_visible_to_customer,
    });

    // 通知管理员
    try {
      const adminUserIds = await getAllAdminUserIds();
      if (adminUserIds.length > 0) {
        const title = `跟进记录：${orderInfo.order_number}`;
        const contentText = `生产跟单${user.username || '用户'}对订单${orderInfo.order_number}添加了跟进记录。\n内容：${content}`;

        for (const adminId of adminUserIds) {
          await createNotification({
            user_id: adminId,
            type: 'reminder',
            title,
            content: contentText,
            related_id: order_id,
            related_type: 'order',
          });
        }
      }
    } catch (notificationError) {
      console.error('创建跟进通知失败:', notificationError);
    }

    // 如果对客户可见，通知客户
    if (is_visible_to_customer && orderInfo.customer_id) {
      try {
        // 获取订单当前状态信息
        const currentOrderResult = await pool.query(
          `SELECT is_completed, can_ship, estimated_ship_date, status
           FROM orders WHERE id = $1`,
          [order_id]
        );
        const currentOrder = currentOrderResult.rows[0];
        
        // 构建通知内容，包含订单状态信息
        let statusInfo = '';
        if (currentOrder.is_completed) {
          statusInfo += '\n订单状态：已完成';
        }
        if (currentOrder.can_ship) {
          statusInfo += '\n可出货：是';
        }
        if (currentOrder.estimated_ship_date) {
          // 格式化日期为 YYYY-MM-DD HH:mm
          const shipDate = new Date(currentOrder.estimated_ship_date);
          const formattedDate = shipDate.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).replace(/\//g, '-');
          statusInfo += `\n预计出货日期：${formattedDate}`;
        }
        
        const title = `订单跟进：${orderInfo.order_number}`;
        const contentText = `您的订单${orderInfo.order_number}有了新的跟进记录。${statusInfo}\n\n跟进内容：${content}`;

        await createNotification({
          user_id: orderInfo.customer_id,
          type: 'reminder',
          title,
          content: contentText,
          related_id: order_id,
          related_type: 'order',
        });
      } catch (notificationError) {
        console.error('创建客户通知失败:', notificationError);
      }
    }

    res.status(201).json({
      message: '跟进记录创建成功',
      followUp,
    });
  } catch (error) {
    console.error('创建跟进记录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 获取订单的跟进记录列表
 */
export const getOrderFollowUps = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const followUps = await getFollowUpsByOrderId(Number(id), {
      user_role: user.role,
      user_id: user.userId,
    });

    res.json({ followUps });
  } catch (error) {
    console.error('获取跟进记录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 生产跟单查看自己的跟进概览
 */
export const getMyFollowUpSummary = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== 'production_manager') {
      return res.status(403).json({ error: '只有生产跟单可以查看该数据' });
    }

    const { page = 1, pageSize = 20 } = req.query;
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM orders WHERE assigned_to = $1',
      [user.userId]
    );

    const summaryQuery = `
      SELECT 
        o.id as order_id,
        o.order_number,
        o.customer_order_number,
        o.status,
        cu.company_name,
        cu.contact_name,
        MAX(f.created_at) as last_follow_up_at,
        COUNT(f.id)::int as follow_up_count,
        COALESCE(BOOL_OR(f.is_visible_to_customer), false) as has_customer_visible
      FROM orders o
      LEFT JOIN order_follow_ups f ON o.id = f.order_id
      LEFT JOIN users cu ON o.customer_id = cu.id
      WHERE o.assigned_to = $1
      GROUP BY o.id, cu.company_name, cu.contact_name
      ORDER BY last_follow_up_at DESC NULLS LAST, o.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const summaryResult = await pool.query(summaryQuery, [
      user.userId,
      limit,
      offset,
    ]);

    res.json({
      summaries: summaryResult.rows,
      pagination: {
        total: parseInt(totalResult.rows[0].total),
        page: Number(page),
        pageSize: limit,
        totalPages: Math.ceil(
          parseInt(totalResult.rows[0].total) / limit
        ),
      },
    });
  } catch (error) {
    console.error('获取跟进概览错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 获取跟进记录详情
 */
export const getFollowUp = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const followUp = await getFollowUpById(Number(id), user.role, user.userId);

    if (!followUp) {
      return res.status(404).json({ error: '跟进记录不存在或无权访问' });
    }

    res.json({ followUp });
  } catch (error) {
    console.error('获取跟进记录详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 更新跟进记录
 */
export const updateOrderFollowUp = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { content, is_visible_to_customer } = req.body;

    if (user.role !== 'production_manager') {
      return res.status(403).json({ error: '只有生产跟单可以更新跟进记录' });
    }

    const updates: any = {};
    if (content !== undefined) updates.content = content;
    if (is_visible_to_customer !== undefined)
      updates.is_visible_to_customer = is_visible_to_customer;

    const followUp = await updateFollowUp(Number(id), user.userId, updates);

    res.json({
      message: '跟进记录更新成功',
      followUp,
    });
  } catch (error: any) {
    if (error.message === '跟进记录不存在或无权修改') {
      return res.status(404).json({ error: error.message });
    }
    console.error('更新跟进记录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

/**
 * 删除跟进记录
 */
export const deleteOrderFollowUp = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (user.role !== 'production_manager') {
      return res.status(403).json({ error: '只有生产跟单可以删除跟进记录' });
    }

    await deleteFollowUp(Number(id), user.userId);

    res.json({
      message: '跟进记录删除成功',
    });
  } catch (error: any) {
    if (error.message === '跟进记录不存在或无权删除') {
      return res.status(404).json({ error: error.message });
    }
    console.error('删除跟进记录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

