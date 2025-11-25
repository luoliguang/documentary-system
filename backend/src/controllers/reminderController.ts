import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  getAllAdminUserIds,
  getAdminAndSupportUserIds,
  createNotification,
} from '../services/notificationService.js';
import { getOrderDisplayNumberSimple, getOrderDisplayInfo } from '../utils/orderDisplayUtils.js';
import { configService } from '../services/configService.js';
import { CONFIG_KEYS } from '../constants/configKeys.js';
import {
  canCreateReminder,
  canRespondReminder,
} from '../services/permissionService.js';
import { addOrderActivity } from '../services/activityService.js';
import { emitReminderUpdated, emitReminderRemoved, emitNotificationCreated } from '../websocket/emitter.js';

const REMINDER_SNAPSHOT_QUERY = `
  SELECT 
    dr.*,
    o.order_number,
    o.customer_order_number,
    o.images,
    u.company_name,
    u.contact_name
  FROM delivery_reminders dr
  LEFT JOIN orders o ON dr.order_id = o.id
  LEFT JOIN users u ON dr.customer_id = u.id
  WHERE dr.id = $1
`;

async function fetchReminderSnapshot(reminderId: number) {
  const snapshotResult = await pool.query(REMINDER_SNAPSHOT_QUERY, [reminderId]);
  return snapshotResult.rows[0] || null;
}

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

    // 获取当前用户所属公司
    const userCompanyResult = await pool.query(
      `SELECT company_id 
       FROM users 
       WHERE id = $1`,
      [user.userId]
    );

    const companyId = userCompanyResult.rows[0]?.company_id;

    // 验证订单属于当前客户的公司（同一公司的所有账号都可以访问）
    const orderResult = await pool.query(
      `SELECT o.id 
       FROM orders o
       WHERE o.id = $1 AND o.company_id = $2`,
      [order_id, companyId]
    );

    if (!companyId || orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    // 检查催货节流：获取最近一次催货记录（同一公司的所有账号）
    const lastReminderResult = await pool.query(
      `SELECT dr.created_at 
       FROM delivery_reminders dr
       INNER JOIN users u ON dr.customer_id = u.id
       WHERE dr.order_id = $1 
         AND u.company_id = (SELECT company_id FROM users WHERE id = $2)
       ORDER BY dr.created_at DESC LIMIT 1`,
      [order_id, user.userId]
    );

    if (lastReminderResult.rows.length > 0) {
      // 获取催货间隔配置
      const intervalHours = await configService.getConfig(CONFIG_KEYS.REMINDER_MIN_INTERVAL_HOURS);
      if (!intervalHours || typeof intervalHours !== 'number' || intervalHours <= 0) {
        return res.status(500).json({ error: '催货间隔配置无效，请联系管理员' });
      }
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

    // 获取订单信息用于通知（包括分配信息）
    const orderInfoResult = await pool.query(
      `SELECT 
         o.order_number, 
         o.customer_order_number, 
         o.assigned_to,
         o.company_id,
         u.company_name, 
         u.contact_name,
         pm.id as production_manager_id,
         pm.username as production_manager_name
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.id
       LEFT JOIN users pm ON o.assigned_to = pm.id
       WHERE o.id = $1`,
      [order_id]
    );
    const orderInfo = orderInfoResult.rows[0];
    
    // 查询订单的所有分配记录（可能有多个生产跟单）
    const assignmentResult = await pool.query(
      `SELECT DISTINCT production_manager_id 
       FROM order_assignments 
       WHERE order_id = $1 AND production_manager_id IS NOT NULL`,
      [order_id]
    );
    const assignedProductionManagerIds = assignmentResult.rows.map(row => row.production_manager_id);

    // 创建催货记录
    const result = await pool.query(
      `INSERT INTO delivery_reminders (order_id, customer_id, reminder_type, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [order_id, user.userId, reminder_type, message || null]
    );

    // 发送催单通知
    // 逻辑：
    // 1. 如果订单已分配给生产跟单，通知：生产跟单 + 管理员/客服（有分配权限的）
    // 2. 如果订单未分配，只通知：管理员/客服（有分配权限的）
    // 3. 管理员/客服始终可以收到催单通知
    try {
      const reminderTypeText = reminder_type === 'urgent' ? '紧急催单' : '催单';
      
      // 获取所有有分配订单权限的用户（管理员和客服）
      const adminAndSupportResult = await pool.query(
        `SELECT id, role 
         FROM users 
         WHERE role IN ('admin', 'customer_service') 
           AND is_active = true`,
        []
      );
      const adminAndSupportUsers = adminAndSupportResult.rows;
      
      // 通知用户列表
      const usersToNotify: Array<{ id: number; role: string }> = [];
      
      // 1. 始终通知管理员和客服（有分配权限的）
      usersToNotify.push(...adminAndSupportUsers);
      
      // 2. 如果订单已分配，也通知生产跟单
      if (orderInfo.assigned_to || assignedProductionManagerIds.length > 0) {
        // 获取所有被分配的生产跟单
        const allAssignedPmIds = new Set<number>();
        
        // 添加主分配的生产跟单
        if (orderInfo.assigned_to) {
          allAssignedPmIds.add(orderInfo.assigned_to);
        }
        
        // 添加所有分配记录中的生产跟单
        assignedProductionManagerIds.forEach((pmId: number) => {
          allAssignedPmIds.add(pmId);
        });
        
        // 查询这些生产跟单的信息
        if (allAssignedPmIds.size > 0) {
          const pmIdsArray = Array.from(allAssignedPmIds);
          const pmResult = await pool.query(
            `SELECT id, role 
             FROM users 
             WHERE id = ANY($1::int[]) 
               AND role = 'production_manager' 
               AND is_active = true`,
            [pmIdsArray]
          );
          usersToNotify.push(...pmResult.rows);
        }
      }
      
      // 为每个用户创建个性化通知
      for (const user of usersToNotify) {
        try {
          // 根据接收者角色生成订单编号显示
          const displayNumber = getOrderDisplayNumberSimple(
            {
              order_number: orderInfo.order_number,
              customer_order_number: orderInfo.customer_order_number,
            },
            user.role
          );
          
          const title = `${reminderTypeText}：${displayNumber || '订单'}`;
          const orderInfoText = getOrderDisplayInfo(
            {
              order_number: orderInfo.order_number,
              customer_order_number: orderInfo.customer_order_number,
            },
            user.role
          );
          const content = message
            ? `客户${orderInfo.company_name || orderInfo.contact_name || '客户'}对订单进行了${reminderTypeText}。\n${orderInfoText}\n催单消息：${message}`
            : `客户${orderInfo.company_name || orderInfo.contact_name || '客户'}对订单进行了${reminderTypeText}。\n${orderInfoText}`;

          const createdNotification = await createNotification({
            user_id: user.id,
            type: 'reminder',
            title,
            content,
            related_id: order_id,
            related_type: 'order',
          });
          
          emitNotificationCreated(createdNotification);
        } catch (notificationError) {
          console.error('创建催单通知失败:', notificationError);
        }
      }
    } catch (notificationError) {
      // 通知创建失败不影响催货记录的创建，只记录日志
      console.error('创建催单通知失败:', notificationError);
    }

    const snapshot = await fetchReminderSnapshot(result.rows[0].id);
    if (snapshot) {
      emitReminderUpdated(result.rows[0].id, snapshot);
    }

    res.status(201).json({
      message: '催货申请已提交',
      reminder: snapshot || result.rows[0],
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

    // 管理员和客服可以查看所有催货记录
    const isAdminOrSupport = user.role === 'admin' || user.role === 'customer_service';
    
    if (isAdminOrSupport) {
      // 管理员和客服查看所有催货记录
      const { 
        order_id, 
        order_number,
        customer_order_number,
        company_name,
        reminder_type,
        is_resolved, 
        start_date,
        end_date,
        page: pageParam, 
        pageSize: pageSizeParam 
      } = req.query;
      const { parsePaginationParams } = await import('../utils/configHelpers.js');
      const { page, pageSize } = await parsePaginationParams(pageParam, pageSizeParam);
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
      // 生产跟单：可以查看管理员派送的催货任务，以及已分配订单的所有催单（包括客户创建的）
      const { 
        order_id,
        order_number,
        customer_order_number,
        reminder_type,
        is_resolved,
        start_date,
        end_date,
        page: pageParam, 
        pageSize: pageSizeParam
      } = req.query;
      const { parsePaginationParams } = await import('../utils/configHelpers.js');
      const { page, pageSize } = await parsePaginationParams(pageParam, pageSizeParam);
      let whereConditions: string[] = [`dr.is_deleted = false`];
      params = [];
      let paramIndex = 1;
      
      // 生产跟单可以查看：
      // 1. 管理员派送的催单（is_admin_assigned = true）
      // 2. 已分配给自己的催单（assigned_to = userId）
      // 3. 已分配订单的所有催单（订单已分配给该生产跟单，无论催单是否分配）
      whereConditions.push(`(
        dr.is_admin_assigned = true 
        OR dr.assigned_to = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM orders o 
          LEFT JOIN order_assignments oa ON oa.order_id = o.id 
          WHERE o.id = dr.order_id 
            AND (o.assigned_to = $${paramIndex} OR oa.production_manager_id = $${paramIndex})
        )
      )`);
      params.push(user.userId);
      paramIndex++;

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
      // 客户可以查看同一公司的所有催货记录
      const { 
        order_number,
        customer_order_number,
        reminder_type,
        is_resolved,
        start_date,
        end_date
      } = req.query;
      let whereConditions: string[] = [
        `u.company_id = (SELECT company_id FROM users WHERE id = $1)`, 
        `dr.is_deleted = false`
      ];
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
        LEFT JOIN users u ON dr.customer_id = u.id
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
        `SELECT o.order_number, o.customer_order_number, u.company_name, u.contact_name, u.id as customer_id
         FROM orders o
         LEFT JOIN users u ON o.customer_id = u.id
         WHERE o.id = $1`,
        [reminder.order_id]
      );
      const orderInfo = orderResult.rows[0];
      
      // 客户角色，优先显示客户订单编号
      const displayNumber = getOrderDisplayNumberSimple(
        {
          order_number: orderInfo.order_number,
          customer_order_number: orderInfo.customer_order_number,
        },
        'customer' // 客户角色
      );

      // 获取回复者信息
      const responderResult = await pool.query(
        `SELECT username, company_name, role FROM users WHERE id = $1`,
        [user.userId]
      );
      const responderInfo = responderResult.rows[0];
      const responderName = responderInfo.company_name || responderInfo.username || '管理员';
      const responderRole = responderInfo.role === 'production_manager' ? '生产跟单' : '管理员';

      // 创建通知给客户（客户角色，优先显示客户订单编号）
      const title = `${responderRole}已回复您的催单：${displayNumber || '订单'}`;
      const orderInfoText = getOrderDisplayInfo(
        {
          order_number: orderInfo.order_number,
          customer_order_number: orderInfo.customer_order_number,
        },
        'customer' // 客户角色
      );
      const content = admin_response
        ? `${responderName}（${responderRole}）已回复您的催单：\n${orderInfoText}\n回复内容：${admin_response}`
        : `${responderName}（${responderRole}）已处理您的催单。\n${orderInfoText}`;

      const createdNotification = await createNotification({
        user_id: reminder.customer_id,
        type: 'reminder',
        title,
        content,
        related_id: reminder.order_id,
        related_type: 'order',
      });
      
      // 实时推送通知
      const { emitNotificationCreated } = await import('../websocket/emitter.js');
      emitNotificationCreated(createdNotification);
    } catch (notificationError) {
      // 通知创建失败不影响回复操作，只记录日志
      console.error('创建回复通知失败:', notificationError);
    }

    // 记录操作日志
    await addOrderActivity({
      orderId: reminder.order_id,
      userId: user.userId,
      actionType: 'reminder_replied',
      actionText: admin_response 
        ? `客服回复催单：${admin_response}`
        : '客服已处理催单',
      extraData: {
        reminder_id: reminder.id,
        admin_response,
        is_resolved,
      },
      isVisibleToCustomer: true,
    });

    const snapshot = await fetchReminderSnapshot(updatedReminder.id);
    if (snapshot) {
      emitReminderUpdated(updatedReminder.id, snapshot);
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

// 生产跟单转交催货任务给其他生产跟单
export const transferReminderToProductionManager = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { assigned_to } = req.body;

    // 只有生产跟单可以转交
    if (user.role !== 'production_manager') {
      return res.status(403).json({ error: '无权操作，只有生产跟单可以转交催单' });
    }

    // 检查催货记录是否存在
    const reminderResult = await pool.query(
      `SELECT dr.*, o.order_type, o.order_number, o.customer_order_number
       FROM delivery_reminders dr
       LEFT JOIN orders o ON dr.order_id = o.id
       WHERE dr.id = $1 AND dr.is_deleted = false`,
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    const reminder = reminderResult.rows[0];

    // 检查订单是否已分配给当前生产跟单
    const orderResult = await pool.query(
      `SELECT o.assigned_to, oa.production_manager_id
       FROM orders o
       LEFT JOIN order_assignments oa ON oa.order_id = o.id AND oa.production_manager_id = $1
       WHERE o.id = $2`,
      [user.userId, reminder.order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];
    const isOrderAssignedToMe = order.assigned_to === user.userId || order.production_manager_id === user.userId;

    // 只有分配给当前生产跟单的催单或订单已分配给当前生产跟单的催单才能转交
    if (reminder.assigned_to !== user.userId && !isOrderAssignedToMe) {
      return res.status(403).json({ error: '无权转交此催单，只能转交分配给自己的催单或已分配订单的催单' });
    }

    // 已处理的催单不能转交
    if (reminder.is_resolved) {
      return res.status(400).json({ error: '已处理的催单不能转交' });
    }

    // 验证目标生产跟单
    if (!assigned_to) {
      return res.status(400).json({ error: '必须指定转交给哪个生产跟单' });
    }

    const targetUserResult = await pool.query(
      `SELECT id, role, username, assigned_order_types FROM users WHERE id = $1 AND is_active = true`,
      [assigned_to]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ error: '目标生产跟单不存在' });
    }

    const targetUser = targetUserResult.rows[0];

    if (targetUser.role !== 'production_manager') {
      return res.status(400).json({ error: '目标用户不是生产跟单' });
    }

    // 验证目标生产跟单是否有权限处理该订单类型
    if (reminder.order_type && targetUser.assigned_order_types) {
      const allowedTypes = Array.isArray(targetUser.assigned_order_types)
        ? targetUser.assigned_order_types
        : JSON.parse(targetUser.assigned_order_types);
      if (allowedTypes.length > 0 && !allowedTypes.includes(reminder.order_type)) {
        return res.status(400).json({
          error: `目标生产跟单 ${targetUser.username} 无权处理 ${reminder.order_type} 类型订单`,
          code: 'TARGET_PM_NO_PERMISSION',
          data: {
            target_user: {
              id: targetUser.id,
              username: targetUser.username,
            },
            order_type: reminder.order_type,
          },
        });
      }
    }

    // 不能转交给自己
    if (assigned_to === user.userId) {
      return res.status(400).json({ error: '不能转交给自己' });
    }

    // 更新催货记录
    const updateResult = await pool.query(
      `UPDATE delivery_reminders 
       SET assigned_to = $1, is_admin_assigned = false
       WHERE id = $2
       RETURNING *`,
      [assigned_to, id]
    );

    const updatedReminder = updateResult.rows[0];

    // 获取订单信息用于通知
    const orderInfoResult = await pool.query(
      `SELECT o.*, u.company_name, u.contact_name 
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.id
       WHERE o.id = $1`,
      [reminder.order_id]
    );
    const orderInfo = orderInfoResult.rows[0] || {};

    // 获取当前用户信息
    const currentUserResult = await pool.query(
      `SELECT username FROM users WHERE id = $1`,
      [user.userId]
    );
    const currentUserName = currentUserResult.rows[0]?.username || '生产跟单';

    // 发送通知
    try {
      const { emitNotificationCreated } = await import('../websocket/emitter.js');

      // 通知目标生产跟单
      const displayNumber = getOrderDisplayNumberSimple(
        {
          order_number: orderInfo.order_number,
          customer_order_number: orderInfo.customer_order_number,
        },
        'production_manager'
      );
      const orderInfoText = getOrderDisplayInfo(
        {
          order_number: orderInfo.order_number,
          customer_order_number: orderInfo.customer_order_number,
        },
        'production_manager'
      );

      const targetNotification = await createNotification({
        user_id: assigned_to,
        type: 'assignment',
        title: `催单转交：${displayNumber || '订单'}`,
        content: `${currentUserName} 将催单转交给您处理。\n${orderInfoText}\n客户：${orderInfo.company_name || orderInfo.contact_name || '未知'}`,
        related_id: reminder.order_id,
        related_type: 'order',
      });
      emitNotificationCreated(targetNotification);

      // 通知管理员（让他们知道转交情况）
      const adminUsers = await getAllAdminUserIds();
      for (const adminId of adminUsers) {
        const adminDisplayNumber = getOrderDisplayNumberSimple(
          {
            order_number: orderInfo.order_number,
            customer_order_number: orderInfo.customer_order_number,
          },
          'admin'
        );
        const adminNotification = await createNotification({
          user_id: adminId,
          type: 'reminder',
          title: `催单转交：${adminDisplayNumber || '订单'}`,
          content: `${currentUserName} 将催单转交给 ${targetUser.username} 处理。\n${orderInfoText}\n客户：${orderInfo.company_name || orderInfo.contact_name || '未知'}`,
          related_id: reminder.order_id,
          related_type: 'order',
        });
        emitNotificationCreated(adminNotification);
      }
    } catch (notificationError) {
      console.error('创建转交通知失败:', notificationError);
    }

    // 记录操作日志
    try {
      await addOrderActivity({
        orderId: reminder.order_id,
        userId: user.userId,
        actionType: 'reminder_transferred',
        actionText: `将催单转交给 ${targetUser.username}`,
        extraData: {
          reminder_id: id,
          from_production_manager_id: user.userId,
          to_production_manager_id: assigned_to,
          to_production_manager_name: targetUser.username,
        },
        isVisibleToCustomer: false,
      });
    } catch (activityError) {
      console.error('记录转交操作日志失败:', activityError);
    }

    const snapshot = await fetchReminderSnapshot(updatedReminder.id);
    if (snapshot) {
      emitReminderUpdated(updatedReminder.id, snapshot);
    }

    res.json({
      message: '催单转交成功',
      reminder: updatedReminder,
    });
  } catch (error) {
    console.error('转交催单错误:', error);
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

    // 管理员和客服可以操作
    if (user.role !== 'admin' && user.role !== 'customer_service') {
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

    const snapshot = await fetchReminderSnapshot(result.rows[0].id);
    if (snapshot) {
      emitReminderUpdated(result.rows[0].id, snapshot);
    }

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

    const snapshot = await fetchReminderSnapshot(result.rows[0].id);
    if (snapshot) {
      emitReminderUpdated(result.rows[0].id, snapshot);
    }

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

    const snapshot = await fetchReminderSnapshot(result.rows[0].id);
    if (snapshot) {
      emitReminderUpdated(result.rows[0].id, snapshot);
    }

    res.json({
      message: '管理员回复更新成功',
      reminder: result.rows[0],
    });
  } catch (error) {
    console.error('编辑管理员回复错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

export const requestReminderTransferPermission = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { target_pm_id, order_type, reason } = req.body;

    if (user.role !== 'production_manager') {
      return res.status(403).json({ error: '无权操作，仅生产跟单可以申请权限' });
    }

    if (!target_pm_id) {
      return res.status(400).json({ error: '必须指定申请的目标生产跟单' });
    }

    const reminderResult = await pool.query(
      `SELECT dr.*, o.order_number, o.customer_order_number, o.order_type
       FROM delivery_reminders dr
       LEFT JOIN orders o ON dr.order_id = o.id
       WHERE dr.id = $1 AND dr.is_deleted = false`,
      [id]
    );

    if (reminderResult.rows.length === 0) {
      return res.status(404).json({ error: '催货记录不存在' });
    }

    const reminder = reminderResult.rows[0];

    const orderAssignmentResult = await pool.query(
      `SELECT o.assigned_to, oa.production_manager_id
       FROM orders o
       LEFT JOIN order_assignments oa ON oa.order_id = o.id AND oa.production_manager_id = $1
       WHERE o.id = $2`,
      [user.userId, reminder.order_id]
    );

    if (orderAssignmentResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const orderAssignment = orderAssignmentResult.rows[0];
    const isOrderAssignedToMe =
      orderAssignment.assigned_to === user.userId ||
      orderAssignment.production_manager_id === user.userId;

    if (reminder.assigned_to !== user.userId && !isOrderAssignedToMe) {
      return res.status(403).json({ error: '无权申请权限，只能为自己负责的催单发起申请' });
    }

    const targetUserResult = await pool.query(
      `SELECT id, username, role FROM users WHERE id = $1 AND is_active = true`,
      [target_pm_id]
    );

    if (targetUserResult.rows.length === 0) {
      return res.status(404).json({ error: '目标生产跟单不存在' });
    }

    const targetUser = targetUserResult.rows[0];

    if (targetUser.role !== 'production_manager') {
      return res.status(400).json({ error: '目标用户不是生产跟单' });
    }

    const pendingResult = await pool.query(
      `SELECT id FROM reminder_permission_requests
       WHERE reminder_id = $1
         AND from_production_manager_id = $2
         AND target_production_manager_id = $3
         AND status = 'pending'
       LIMIT 1`,
      [id, user.userId, target_pm_id]
    );

    if (pendingResult.rows.length > 0) {
      return res.status(409).json({
        error: '已经提交过申请，请等待管理员处理',
        code: 'PERMISSION_REQUEST_PENDING',
      });
    }

    const requestedPermission = {
      order_type: order_type || reminder.order_type || null,
      reason: reason || null,
    };

    const insertResult = await pool.query(
      `INSERT INTO reminder_permission_requests (
        reminder_id,
        order_id,
        from_production_manager_id,
        target_production_manager_id,
        requested_permission,
        status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`,
      [
        reminder.id,
        reminder.order_id,
        user.userId,
        target_pm_id,
        JSON.stringify(requestedPermission),
      ]
    );

    const adminAndSupportIds = await getAdminAndSupportUserIds();
    const displayNumber = getOrderDisplayNumberSimple(
      {
        order_number: reminder.order_number,
        customer_order_number: reminder.customer_order_number,
      },
      'admin'
    );
    const orderInfoText = getOrderDisplayInfo(
      {
        order_number: reminder.order_number,
        customer_order_number: reminder.customer_order_number,
      },
      'admin'
    );

    for (const adminId of adminAndSupportIds) {
      try {
        const notification = await createNotification({
          user_id: adminId,
          type: 'reminder',
          title: `催单权限申请：${displayNumber || '订单'}`,
          content: `生产跟单 ${user.username || '生产跟单'} 请求为 ${targetUser.username} 开通 ${
            requestedPermission.order_type || '该订单'
          } 权限。\n${orderInfoText}${
            requestedPermission.reason ? `\n备注：${requestedPermission.reason}` : ''
          }`,
          related_id: reminder.order_id,
          related_type: 'order',
        });
        emitNotificationCreated(notification);
      } catch (notificationError) {
        console.error('创建权限申请通知失败:', notificationError);
      }
    }

    try {
      await addOrderActivity({
        orderId: reminder.order_id,
        userId: user.userId,
        actionType: 'permission_request_submitted',
        actionText: `申请为 ${targetUser.username} 开通 ${
          requestedPermission.order_type || '该订单'
        } 权限`,
        extraData: {
          reminder_id: reminder.id,
          target_production_manager_id: target_pm_id,
          requested_permission: requestedPermission,
        },
        isVisibleToCustomer: false,
      });
    } catch (activityError) {
      console.error('记录权限申请日志失败:', activityError);
    }

    res.json({
      message: '已通知管理员，请等待权限处理',
      request: insertResult.rows[0],
    });
  } catch (error) {
    console.error('提交催单权限申请错误:', error);
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

    emitReminderRemoved(Number(id));

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

    // 验证订单属于当前客户的公司（同一公司的所有账号都可以访问）
    const orderResult = await pool.query(
      `SELECT o.id 
       FROM orders o
       WHERE o.id = $1 AND o.company_id = (SELECT company_id FROM users WHERE id = $2)`,
      [order_id, user.userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在或无权访问' });
    }

    // 获取催货统计（同一公司的所有账号的催货记录）
    // 需要查询同一公司的所有用户的催货记录
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE dr.is_deleted = false) as visible_count,
         COUNT(*) as total_count_all,
         MAX(dr.created_at) as last_reminder_time
       FROM delivery_reminders dr
       INNER JOIN users u ON dr.customer_id = u.id
       WHERE dr.order_id = $1 
         AND u.company_id = (SELECT company_id FROM users WHERE id = $2)`,
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

