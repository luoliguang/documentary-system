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
import {
  canCreateFollowUp,
  canAccessFollowUp,
} from '../services/permissionService.js';
import { getOrderDisplayNumberSimple, getOrderDisplayInfo } from '../utils/orderDisplayUtils.js';

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

    // 使用权限服务检查创建权限
    const canCreate = await canCreateFollowUp(user.userId, user.role, order_id);
    if (!canCreate) {
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

    // 记录操作日志
    const { addOrderActivity } = await import('../services/activityService.js');
    await addOrderActivity({
      orderId: order_id,
      userId: user.userId,
      actionType: 'follow_up_added',
      actionText: `生产跟单添加跟进：${content}`,
      extraData: {
        follow_up_id: followUp.id,
        content,
      },
      isVisibleToCustomer: is_visible_to_customer,
    });

    // 通知管理员和客户
    const { emitNotificationCreated } = await import('../websocket/emitter.js');
    
    try {
      const adminUserIds = await getAllAdminUserIds();
      if (adminUserIds.length > 0) {
        // 为每个管理员创建个性化通知（虽然管理员都是admin角色，但保持一致性）
        for (const adminId of adminUserIds) {
          try {
            // 获取接收通知的用户角色（虽然都是admin，但保持代码一致性）
            const userResult = await pool.query(
              'SELECT role FROM users WHERE id = $1',
              [adminId]
            );
            const recipientRole = userResult.rows[0]?.role || 'admin';
            
            // 根据接收者角色生成订单编号显示
            const displayNumber = getOrderDisplayNumberSimple(
              {
                order_number: orderInfo.order_number,
                customer_order_number: orderInfo.customer_order_number,
              },
              recipientRole
            );
            
            const title = `跟进记录：${displayNumber}`;
            const orderInfoText = getOrderDisplayInfo(
              {
                order_number: orderInfo.order_number,
                customer_order_number: orderInfo.customer_order_number,
              },
              recipientRole
            );
            const contentText = `生产跟单${user.username || '用户'}对订单添加了跟进记录。\n${orderInfoText}\n内容：${content}`;

            const createdNotification = await createNotification({
              user_id: adminId,
              type: 'reminder',
              title,
              content: contentText,
              related_id: order_id,
              related_type: 'order',
            });
            // 实时推送通知
            emitNotificationCreated(createdNotification);
          } catch (notificationError) {
            console.error('创建跟进记录通知失败:', notificationError);
          }
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
        
        // 客户角色，优先显示客户订单编号
        const displayNumber = getOrderDisplayNumberSimple(
          {
            order_number: orderInfo.order_number,
            customer_order_number: orderInfo.customer_order_number,
          },
          'customer' // 客户角色
        );
        const orderInfoText = getOrderDisplayInfo(
          {
            order_number: orderInfo.order_number,
            customer_order_number: orderInfo.customer_order_number,
          },
          'customer' // 客户角色
        );
        
        const title = `订单跟进：${displayNumber}`;
        const contentText = `您的订单有了新的跟进记录。${orderInfoText}${statusInfo}\n\n跟进内容：${content}`;

        const createdNotification = await createNotification({
          user_id: orderInfo.customer_id,
          type: 'reminder',
          title,
          content: contentText,
          related_id: order_id,
          related_type: 'order',
        });
        
        // 实时推送通知
        emitNotificationCreated(createdNotification);
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
    // 使用权限服务检查角色权限
    if (user.role !== 'production_manager') {
      return res.status(403).json({ error: '只有生产跟单可以查看该数据' });
    }

    const {
      page = 1,
      pageSize = 20,
      status,
      keyword,
      hasFollowUp,
      hasCustomerVisible,
      hasDocument,
    } = req.query;

    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    const whereClauses: string[] = [
      `(o.assigned_to = $1 OR EXISTS (
        SELECT 1 FROM order_assignments oa
        WHERE oa.order_id = o.id AND oa.production_manager_id = $2
      ))`,
    ];
    const whereParams: any[] = [user.userId, user.userId];
    let paramIndex = whereParams.length + 1;

    const parseBooleanQuery = (value?: string | string[]) => {
      if (Array.isArray(value)) {
        return value[value.length - 1];
      }
      return value;
    };

    if (status && typeof status === 'string') {
      whereClauses.push(`o.status = $${paramIndex++}`);
      whereParams.push(status);
    }

    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      whereClauses.push(
        `(o.order_number ILIKE $${paramIndex} OR o.customer_order_number ILIKE $${paramIndex} OR cu.company_name ILIKE $${paramIndex})`
      );
      whereParams.push(`%${keyword.trim()}%`);
      paramIndex++;
    }

    const hasDocumentValue = parseBooleanQuery(
      (hasDocument as string | string[]) ?? undefined
    );
    if (hasDocumentValue === 'true') {
      whereClauses.push(
        `jsonb_array_length(COALESCE(o.images, '[]'::jsonb)) > 0`
      );
    } else if (hasDocumentValue === 'false') {
      whereClauses.push(
        `jsonb_array_length(COALESCE(o.images, '[]'::jsonb)) = 0`
      );
    }

    const havingClauses: string[] = [];

    const hasFollowUpValue = parseBooleanQuery(
      (hasFollowUp as string | string[]) ?? undefined
    );
    if (hasFollowUpValue === 'true') {
      havingClauses.push('COUNT(f.id) > 0');
    } else if (hasFollowUpValue === 'false') {
      havingClauses.push('COUNT(f.id) = 0');
    }

    const hasCustomerVisibleValue = parseBooleanQuery(
      (hasCustomerVisible as string | string[]) ?? undefined
    );
    if (hasCustomerVisibleValue === 'true') {
      havingClauses.push('COALESCE(BOOL_OR(f.is_visible_to_customer), false) = true');
    } else if (hasCustomerVisibleValue === 'false') {
      havingClauses.push('COALESCE(BOOL_OR(f.is_visible_to_customer), false) = false');
    }

    const whereClause = whereClauses.join(' AND ');
    const havingClause =
      havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : '';

    const baseQuery = `
      FROM orders o
      LEFT JOIN order_follow_ups f ON o.id = f.order_id
      LEFT JOIN users cu ON o.customer_id = cu.id
      WHERE ${whereClause}
      GROUP BY o.id, cu.company_name, cu.contact_name, o.images
      ${havingClause}
    `;

    const limitPlaceholder = `$${paramIndex++}`;
    const offsetPlaceholder = `$${paramIndex++}`;

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
        COALESCE(BOOL_OR(f.is_visible_to_customer), false) as has_customer_visible,
        o.images,
        COALESCE(jsonb_array_length(COALESCE(o.images, '[]'::jsonb)), 0)::int as image_count
      ${baseQuery}
      ORDER BY last_follow_up_at DESC NULLS LAST, o.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `;

    const totalQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT o.id
        ${baseQuery}
      ) AS summary_count
    `;

    const [totalResult, summaryResult] = await Promise.all([
      pool.query(totalQuery, whereParams),
      pool.query(summaryQuery, [...whereParams, limit, offset]),
    ]);

    const summaries = summaryResult.rows.map((row) => {
      let images: string[] = [];
      if (Array.isArray(row.images)) {
        images = row.images;
      } else if (typeof row.images === 'string') {
        try {
          images = JSON.parse(row.images);
        } catch {
          images = [];
        }
      } else if (row.images) {
        images = [];
      }

      return {
        ...row,
        images,
        has_document: images.length > 0,
      };
    });

    res.json({
      summaries,
      pagination: {
        total: parseInt(totalResult.rows[0].total),
        page: Number(page),
        pageSize: limit,
        totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / limit),
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

    // 使用权限服务检查访问权限
    const canAccess = await canAccessFollowUp(user.userId, user.role, Number(id));
    if (!canAccess) {
      return res.status(403).json({ error: '跟进记录不存在或无权访问' });
    }

    const followUp = await getFollowUpById(Number(id), user.role, user.userId);

    if (!followUp) {
      return res.status(404).json({ error: '跟进记录不存在' });
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

    // 使用权限服务检查访问权限（更新需要先能访问）
    const canAccess = await canAccessFollowUp(user.userId, user.role, Number(id));
    if (!canAccess || user.role !== 'production_manager') {
      return res.status(403).json({ error: '您没有权限更新此跟进记录' });
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

    // 使用权限服务检查访问权限（删除需要先能访问）
    const canAccess = await canAccessFollowUp(user.userId, user.role, Number(id));
    if (!canAccess || user.role !== 'production_manager') {
      return res.status(403).json({ error: '您没有权限删除此跟进记录' });
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

