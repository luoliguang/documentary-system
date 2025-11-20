import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  createNotificationsForUsers,
  getAllAdminUserIds,
  createNotification,
} from '../services/notificationService.js';
import { configService } from '../services/configService.js';
import {
  canCreateReminder,
  canRespondReminder,
} from '../services/permissionService.js';

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

    // 检查催货节流：获取最近一次催货记录
    const lastReminderResult = await pool.query(
      `SELECT created_at FROM delivery_reminders 
       WHERE order_id = $1 AND customer_id = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [order_id, user.userId]
    );

    if (lastReminderResult.rows.length > 0) {
      // 获取催货间隔配置（默认2小时）
      const intervalHours = await configService.getConfig('reminder_min_interval_hours') || 2;
      const lastReminderTime = new Date(lastReminderResult.rows[0].created_at);
      const now = new Date();
      const hoursSinceLastReminder = (now.getTime() - lastReminderTime.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastReminder < intervalHours) {
        const remainingHours = intervalHours - hoursSinceLastReminder;
        const nextReminderTime = new Date(lastReminderTime.getTime() + intervalHours * 60 * 60 * 1000);
        return res.status(429).json({
          error: `催货过于频繁，请等待 ${remainingHours.toFixed(1)} 小时后再试`,
          next_reminder_time: nextReminderTime.toISOString(),
          interval_hours: intervalHours,
        });
      }
    }

    // 获取订单信息用于通知
    const orderInfoResult = await pool.query(
      `SELECT o.order_number, o.customer_order_number, u.company_name, u.contact_name
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.id
       WHERE o.id = $1`,
      [order_id]
    );
    const orderInfo = orderInfoResult.rows[0];

    // 创建催货记录
    const result = await pool.query(
      `INSERT INTO delivery_reminders (order_id, customer_id, reminder_type, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [order_id, user.userId, reminder_type, message || null]
    );

    // 向所有管理员发送催单通知
    try {
      const adminUserIds = await getAllAdminUserIds();
      if (adminUserIds.length > 0) {
        const reminderTypeText = reminder_type === 'urgent' ? '紧急催单' : '催单';
        const title = `${reminderTypeText}：${orderInfo.order_number || '订单'}`;
        const content = message
          ? `客户${orderInfo.company_name || orderInfo.contact_name || '客户'}对订单${orderInfo.order_number}进行了${reminderTypeText}。\n催单消息：${message}`
          : `客户${orderInfo.company_name || orderInfo.contact_name || '客户'}对订单${orderInfo.order_number}进行了${reminderTypeText}。`;

        await createNotificationsForUsers(adminUserIds, {
          type: 'reminder',
          title,
          content,
          related_id: order_id, // 使用订单ID,方便在订单列表中显示
          related_type: 'order', // 使用order类型,统一处理
        });
      }
    } catch (notificationError) {
      // 通知创建失败不影响催货记录的创建，只记录日志
      console.error('创建催单通知失败:', notificationError);
    }

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
      const { 
        order_id, 
        order_number,
        customer_order_number,
        company_name,
        reminder_type,
        is_resolved, 
        start_date,
        end_date,
        page = 1, 
        pageSize = 20 
      } = req.query;
      let whereConditions: string[] = ['dr.is_deleted = false'];
      params = [];
      let paramIndex = 1;

      if (order_id) {
        whereConditions.push(`dr.order_id = $${paramIndex++}`);
        params.push(order_id);
      }

      if (order_number) {
        whereConditions.push(`o.order_number ILIKE $${paramIndex++}`);
        params.push(`%${order_number}%`);
      }

      if (customer_order_number) {
        whereConditions.push(`o.customer_order_number ILIKE $${paramIndex++}`);
        params.push(`%${customer_order_number}%`);
      }

      if (company_name) {
        whereConditions.push(`u.company_name ILIKE $${paramIndex++}`);
        params.push(`%${company_name}%`);
      }

      if (reminder_type) {
        whereConditions.push(`dr.reminder_type = $${paramIndex++}`);
        params.push(reminder_type);
      }

      if (is_resolved !== undefined) {
        whereConditions.push(`dr.is_resolved = $${paramIndex++}`);
        params.push(is_resolved === 'true');
      }

      if (start_date) {
        whereConditions.push(`dr.created_at >= $${paramIndex++}`);
        params.push(start_date);
      }

      if (end_date) {
        whereConditions.push(`dr.created_at <= $${paramIndex++}`);
        params.push(end_date);
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
          o.customer_order_number,
          o.customer_code,
          o.images,
          u.company_name,
          u.contact_name
        FROM delivery_reminders dr
        LEFT JOIN orders o ON dr.order_id = o.id
        LEFT JOIN users u ON dr.customer_id = u.id
        ${whereClause}
        ORDER BY dr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      // 添加总数查询
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM delivery_reminders dr
        LEFT JOIN orders o ON dr.order_id = o.id
        LEFT JOIN users u ON dr.customer_id = u.id
        ${whereClause}
      `;
      const countResult = await pool.query(
        countQuery,
        params.slice(0, params.length - 2)
      );
      const result = await pool.query(query, params);

      res.json({
        reminders: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].total) / Number(pageSize)
          ),
        },
      });
      return;
    } else if (user.role === 'production_manager') {
      // 生产跟单：只能查看管理员派送的催货任务
      const { 
        order_id,
        order_number,
        customer_order_number,
        reminder_type,
        is_resolved,
        start_date,
        end_date,
        page = 1, 
        pageSize = 20 
      } = req.query;
      let whereConditions: string[] = [`dr.is_admin_assigned = true`, `dr.is_deleted = false`];
      params = [];
      let paramIndex = 1;
      
      // 如果指定了assigned_to，则只显示分配给自己的
      whereConditions.push(`(dr.assigned_to IS NULL OR dr.assigned_to = $${paramIndex++})`);
      params.push(user.userId);

      if (order_id) {
        whereConditions.push(`dr.order_id = $${paramIndex++}`);
        params.push(order_id);
      }

      if (order_number) {
        whereConditions.push(`o.order_number ILIKE $${paramIndex++}`);
        params.push(`%${order_number}%`);
      }

      if (customer_order_number) {
        whereConditions.push(`o.customer_order_number ILIKE $${paramIndex++}`);
        params.push(`%${customer_order_number}%`);
      }

      if (reminder_type) {
        whereConditions.push(`dr.reminder_type = $${paramIndex++}`);
        params.push(reminder_type);
      }

      if (is_resolved !== undefined) {
        whereConditions.push(`dr.is_resolved = $${paramIndex++}`);
        params.push(is_resolved === 'true');
      }

      if (start_date) {
        whereConditions.push(`dr.created_at >= $${paramIndex++}`);
        params.push(start_date);
      }

      if (end_date) {
        whereConditions.push(`dr.created_at <= $${paramIndex++}`);
        params.push(end_date);
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      const offset = (Number(page) - 1) * Number(pageSize);
      params.push(Number(pageSize), offset);

      query = `
        SELECT 
          dr.*,
          o.order_number,
          o.customer_order_number,
          o.customer_code,
          o.images,
          u.company_name,
          u.contact_name
        FROM delivery_reminders dr
        LEFT JOIN orders o ON dr.order_id = o.id
        LEFT JOIN users u ON dr.customer_id = u.id
        ${whereClause}
        ORDER BY dr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM delivery_reminders dr
        LEFT JOIN orders o ON dr.order_id = o.id
        LEFT JOIN users u ON dr.customer_id = u.id
        ${whereClause}
      `;
      const countResult = await pool.query(
        countQuery,
        params.slice(0, params.length - 2)
      );
      const result = await pool.query(query, params);

      res.json({
        reminders: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(
            parseInt(countResult.rows[0].total) / Number(pageSize)
          ),
        },
      });
      return;
    } else {
      // 客户只能查看自己的催货记录
      const { 
        order_number,
        customer_order_number,
        reminder_type,
        is_resolved,
        start_date,
        end_date
      } = req.query;
      let whereConditions: string[] = [`dr.customer_id = $1`, `dr.is_deleted = false`];
      params = [user.userId];
      let paramIndex = 2;

      if (order_number) {
        whereConditions.push(`o.order_number ILIKE $${paramIndex++}`);
        params.push(`%${order_number}%`);
      }

      if (customer_order_number) {
        whereConditions.push(`o.customer_order_number ILIKE $${paramIndex++}`);
        params.push(`%${customer_order_number}%`);
      }

      if (reminder_type) {
        whereConditions.push(`dr.reminder_type = $${paramIndex++}`);
        params.push(reminder_type);
      }

      if (is_resolved !== undefined) {
        whereConditions.push(`dr.is_resolved = $${paramIndex++}`);
        params.push(is_resolved === 'true');
      }

      if (start_date) {
        whereConditions.push(`dr.created_at >= $${paramIndex++}`);
        params.push(start_date);
      }

      if (end_date) {
        whereConditions.push(`dr.created_at <= $${paramIndex++}`);
        params.push(end_date);
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      query = `
        SELECT 
          dr.*,
          o.order_number,
          o.customer_order_number,
          o.images
        FROM delivery_reminders dr
        LEFT JOIN orders o ON dr.order_id = o.id
        ${whereClause}
        ORDER BY dr.created_at DESC
      `;
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
    const user = req.user!;
    const { id } = req.params;
    const { admin_response, is_resolved = true } = req.body;

    // 检查催货记录是否存在（包括已删除的记录）
    const reminderResult = await pool.query(
      'SELECT * FROM delivery_reminders WHERE id = $1',
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    const reminder = reminderResult.rows[0];

    // 已删除的记录不能回复
    if (reminder.is_deleted) {
      return res.status(400).json({ error: '催货记录已被删除，无法回复' });
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

    const updatedReminder = result.rows[0];

    // 向客户发送回复通知
    try {
      // 获取订单信息
      const orderResult = await pool.query(
        `SELECT o.order_number, o.customer_order_number, u.company_name, u.contact_name
         FROM orders o
         LEFT JOIN users u ON o.customer_id = u.id
         WHERE o.id = $1`,
        [reminder.order_id]
      );
      const orderInfo = orderResult.rows[0];

      // 获取回复者信息
      const responderResult = await pool.query(
        `SELECT username, company_name, role FROM users WHERE id = $1`,
        [user.userId]
      );
      const responderInfo = responderResult.rows[0];
      const responderName = responderInfo.company_name || responderInfo.username || '管理员';
      const responderRole = responderInfo.role === 'production_manager' ? '生产跟单' : '管理员';

      // 创建通知给客户
      const title = `${responderRole}已回复您的催单：${orderInfo.order_number || '订单'}`;
      const content = admin_response
        ? `${responderName}（${responderRole}）已回复您的催单：\n${admin_response}`
        : `${responderName}（${responderRole}）已处理您的催单。`;

      await createNotification({
        user_id: reminder.customer_id,
        type: 'reminder',
        title,
        content,
        related_id: reminder.order_id,
        related_type: 'order',
      });
    } catch (notificationError) {
      // 通知创建失败不影响回复操作，只记录日志
      console.error('创建回复通知失败:', notificationError);
    }

    res.json({
      message: '回复成功',
      reminder: updatedReminder,
    });
  } catch (error) {
    console.error('回复催货错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 管理员派送催货任务给生产跟单
export const assignReminderToProductionManager = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { assigned_to } = req.body;

    // 只有管理员可以操作
    if (user.role !== 'admin') {
      return res.status(403).json({ error: '无权操作' });
    }

    // 检查催货记录是否存在（包括已删除的记录）
    const reminderResult = await pool.query(
      'SELECT * FROM delivery_reminders WHERE id = $1',
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    const reminder = reminderResult.rows[0];

    // 已删除的记录不能派送
    if (reminder.is_deleted) {
      return res.status(400).json({ error: '催货记录已被删除，无法派送' });
    }

    // 如果指定了assigned_to，验证该用户是否为生产跟单
    if (assigned_to) {
      const userResult = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [assigned_to]
      );
      if (
        userResult.rows.length === 0 ||
        userResult.rows[0].role !== 'production_manager'
      ) {
        return res.status(400).json({ error: '指定的用户不是生产跟单' });
      }
    }

    // 更新催货记录
    const result = await pool.query(
      `UPDATE delivery_reminders 
       SET is_admin_assigned = true, assigned_to = $1 
       WHERE id = $2
       RETURNING *`,
      [assigned_to || null, id]
    );

    res.json({
      message: '催货任务派送成功',
      reminder: result.rows[0],
    });
  } catch (error) {
    console.error('派送催货任务错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 编辑催货消息（仅创建者）
export const updateReminderMessage = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { message } = req.body;

    // 检查催货记录是否存在（包括已删除的记录）
    const reminderResult = await pool.query(
      'SELECT * FROM delivery_reminders WHERE id = $1',
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    const reminder = reminderResult.rows[0];

    // 已删除的记录不能编辑
    if (reminder.is_deleted) {
      return res.status(400).json({ error: '催货记录已被删除，无法编辑' });
    }

    // 只有创建者（客户）可以编辑催货消息
    if (reminder.customer_id !== user.userId) {
      return res.status(403).json({ error: '无权编辑此催货消息' });
    }

    // 已处理的催单不能编辑
    if (reminder.is_resolved) {
      return res.status(403).json({ error: '已处理的催单不能编辑' });
    }

    // 更新催货消息
    const result = await pool.query(
      `UPDATE delivery_reminders
       SET message = $1
       WHERE id = $2
       RETURNING *`,
      [message || null, id]
    );

    res.json({
      message: '催货消息更新成功',
      reminder: result.rows[0],
    });
  } catch (error) {
    console.error('编辑催货消息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 编辑管理员回复（管理员和生产跟单）
export const updateAdminResponse = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { admin_response } = req.body;

    // 只有管理员和生产跟单可以编辑回复
    if (user.role !== 'admin' && user.role !== 'production_manager') {
      return res.status(403).json({ error: '无权编辑管理员回复' });
    }

    // 检查催货记录是否存在（包括已删除的记录）
    const reminderResult = await pool.query(
      'SELECT * FROM delivery_reminders WHERE id = $1',
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    const reminder = reminderResult.rows[0];

    // 已删除的记录不能编辑
    if (reminder.is_deleted) {
      return res.status(400).json({ error: '催货记录已被删除，无法编辑' });
    }

    // 使用权限服务检查回复权限
    const canRespond = await canRespondReminder(user.role);
    if (!canRespond) {
      return res.status(403).json({ error: '您没有权限回复此催货记录' });
    }

    // 生产跟单只能编辑分配给自己的催货任务的回复
    if (user.role === 'production_manager') {
      if (!reminder.is_admin_assigned || 
          (reminder.assigned_to !== null && reminder.assigned_to !== user.userId)) {
        return res.status(403).json({ error: '无权编辑此回复' });
      }
    }

    // 更新管理员回复
    const result = await pool.query(
      `UPDATE delivery_reminders
       SET admin_response = $1
       WHERE id = $2
       RETURNING *`,
      [admin_response || null, id]
    );

    res.json({
      message: '管理员回复更新成功',
      reminder: result.rows[0],
    });
  } catch (error) {
    console.error('编辑管理员回复错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 删除催货记录
export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    // 检查催货记录是否存在（包括已删除的记录）
    const reminderResult = await pool.query(
      'SELECT * FROM delivery_reminders WHERE id = $1',
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    const reminder = reminderResult.rows[0];

    // 如果已经删除，返回提示
    if (reminder.is_deleted) {
      return res.status(400).json({ error: '催货记录已被删除' });
    }

    // 管理员可以删除所有记录，客户只能删除自己的记录，生产跟单不能删除
    if (user.role === 'production_manager') {
      return res.status(403).json({ error: '无权删除此催货记录' });
    }
    if (user.role !== 'admin' && reminder.customer_id !== user.userId) {
      return res.status(403).json({ error: '无权删除此催货记录' });
    }

    // 软删除催货记录
    await pool.query(
      `UPDATE delivery_reminders 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 
       WHERE id = $2`,
      [user.userId, id]
    );

    res.json({
      message: '催货记录删除成功',
    });
  } catch (error) {
    console.error('删除催货记录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取订单的催货统计信息（客户查看自己的订单）
export const getOrderReminderStats = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { order_id } = req.params;

    // 验证订单属于当前客户
    const orderResult = await pool.query(
      'SELECT id FROM orders WHERE id = $1 AND customer_id = $2',
      [order_id, user.userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    // 获取催货统计（区分可见和全部记录）
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE is_deleted = false) as visible_count,
         COUNT(*) as total_count_all,
         MAX(created_at) as last_reminder_time
       FROM delivery_reminders 
       WHERE order_id = $1 AND customer_id = $2`,
      [order_id, user.userId]
    );

    const stats = statsResult.rows[0];
    const intervalHours = await configService.getConfig('reminder_min_interval_hours') || 2;

    // 计算下次可催货时间（基于最后一次催货，无论是否删除）
    let nextReminderTime: string | null = null;
    if (stats.last_reminder_time) {
      const lastTime = new Date(stats.last_reminder_time);
      const nextTime = new Date(lastTime.getTime() + intervalHours * 60 * 60 * 1000);
      nextReminderTime = nextTime.toISOString();
    }

    const totalCount = parseInt(stats.total_count_all || '0');
    const visibleCount = parseInt(stats.visible_count || '0');

    res.json({
      total_count: totalCount,
      visible_count: visibleCount,
      last_reminder_time: stats.last_reminder_time || null,
      next_reminder_time: nextReminderTime,
      interval_hours: intervalHours,
    });
  } catch (error) {
    console.error('获取催货统计错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

