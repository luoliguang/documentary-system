import { pool } from '../config/database.js';

export interface Notification {
  id: number;
  user_id: number;
  type: 'reminder' | 'assignment';
  title: string;
  content: string | null;
  related_id: number | null;
  related_type: 'order' | 'reminder' | null;
  is_read: boolean;
  created_at: Date;
  read_at: Date | null;
}

export interface CreateNotificationParams {
  user_id: number;
  type: 'reminder' | 'assignment';
  title: string;
  content?: string;
  related_id?: number;
  related_type?: 'order' | 'reminder';
}

/**
 * 创建通知
 */
export const createNotification = async (
  params: CreateNotificationParams
): Promise<Notification> => {
  const { user_id, type, title, content, related_id, related_type } = params;

  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user_id, type, title, content || null, related_id || null, related_type || null]
  );

  return result.rows[0];
};

/**
 * 批量创建通知（用于向多个用户发送通知）
 */
export const createNotificationsForUsers = async (
  user_ids: number[],
  params: Omit<CreateNotificationParams, 'user_id'>
): Promise<Notification[]> => {
  if (user_ids.length === 0) {
    return [];
  }

  const notifications: Notification[] = [];
  const { type, title, content, related_id, related_type } = params;

  // 使用事务批量插入
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const user_id of user_ids) {
      const result = await client.query(
        `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [user_id, type, title, content || null, related_id || null, related_type || null]
      );
      notifications.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return notifications;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * 获取用户未读通知数量
 */
export const getUnreadCount = async (user_id: number): Promise<number> => {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
    [user_id]
  );

  return parseInt(result.rows[0].count);
};

/**
 * 获取用户通知列表
 */
export const getNotifications = async (
  user_id: number,
  options: {
    page?: number;
    pageSize?: number;
    is_read?: boolean;
    type?: string;
  } = {}
): Promise<{ notifications: Notification[]; total: number }> => {
  const { page = 1, pageSize = 20, is_read, type } = options;

  let whereConditions: string[] = ['user_id = $1'];
  const params: any[] = [user_id];
  let paramIndex = 2;

  if (is_read !== undefined) {
    whereConditions.push(`is_read = $${paramIndex++}`);
    params.push(is_read);
  }

  if (type) {
    whereConditions.push(`type = $${paramIndex++}`);
    params.push(type);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  // 获取总数
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
    params.slice(0, params.length - 2)
  );

  // 获取通知列表
  const result = await pool.query(
    `SELECT * FROM notifications
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    params
  );

  return {
    notifications: result.rows,
    total: parseInt(countResult.rows[0].total),
  };
};

/**
 * 标记通知为已读
 */
export const markAsRead = async (
  notification_id: number,
  user_id: number
): Promise<Notification> => {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notification_id, user_id]
  );

  if (result.rows.length === 0) {
    throw new Error('通知不存在或无权访问');
  }

  return result.rows[0];
};

/**
 * 标记用户所有通知为已读
 */
export const markAllAsRead = async (user_id: number): Promise<number> => {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND is_read = false
     RETURNING id`,
    [user_id]
  );

  return result.rows.length;
};

/**
 * 删除通知
 */
export const deleteNotification = async (
  notification_id: number,
  user_id: number
): Promise<void> => {
  const result = await pool.query(
    `DELETE FROM notifications
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notification_id, user_id]
  );

  if (result.rows.length === 0) {
    throw new Error('通知不存在或无权删除');
  }
};

/**
 * 批量删除通知
 */
export const deleteNotifications = async (
  notification_ids: number[],
  user_id: number
): Promise<number> => {
  if (notification_ids.length === 0) {
    return 0;
  }

  const result = await pool.query(
    `DELETE FROM notifications
     WHERE id = ANY($1::int[]) AND user_id = $2
     RETURNING id`,
    [notification_ids, user_id]
  );

  return result.rows.length;
};

/**
 * 批量标记订单相关通知为已读
 */
export const markOrderNotificationsAsRead = async (
  user_id: number,
  order_id: number
): Promise<number> => {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND related_id = $2 AND related_type = 'order' AND is_read = false
     RETURNING id`,
    [user_id, order_id]
  );

  return result.rows.length;
};

/**
 * 获取所有管理员用户ID
 */
export const getAllAdminUserIds = async (): Promise<number[]> => {
  const result = await pool.query(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = true",
    []
  );

  return result.rows.map((row) => row.id);
};

export const getAdminAndSupportUserIds = async (): Promise<number[]> => {
  const result = await pool.query(
    "SELECT id FROM users WHERE role IN ('admin', 'customer_service') AND is_active = true",
    []
  );
  return result.rows.map((row) => row.id);
};

