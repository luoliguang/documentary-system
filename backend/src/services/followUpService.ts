import { pool } from '../config/database.js';

export interface FollowUp {
  id: number;
  order_id: number;
  production_manager_id: number;
  content: string;
  is_visible_to_customer: boolean;
  created_at: Date;
  updated_at: Date;
  // 关联数据
  production_manager_name?: string;
  order_number?: string;
}

export interface CreateFollowUpParams {
  order_id: number;
  production_manager_id: number;
  content: string;
  is_visible_to_customer?: boolean;
}

/**
 * 创建跟进记录
 */
export const createFollowUp = async (
  params: CreateFollowUpParams
): Promise<FollowUp> => {
  const { order_id, production_manager_id, content, is_visible_to_customer = true } = params;

  const result = await pool.query(
    `INSERT INTO order_follow_ups (order_id, production_manager_id, content, is_visible_to_customer)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [order_id, production_manager_id, content, is_visible_to_customer]
  );

  return result.rows[0];
};

/**
 * 获取订单的跟进记录列表
 */
export const getFollowUpsByOrderId = async (
  order_id: number,
  options: {
    user_role?: string;
    user_id?: number;
  } = {}
): Promise<FollowUp[]> => {
  const { user_role, user_id } = options;

  let query: string;
  let params: any[];

  if (user_role === 'admin') {
    // 管理员可以查看所有跟进记录
    query = `
      SELECT 
        f.*,
        u.username as production_manager_name,
        o.order_number
      FROM order_follow_ups f
      LEFT JOIN users u ON f.production_manager_id = u.id
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE f.order_id = $1
      ORDER BY f.created_at DESC
    `;
    params = [order_id];
  } else if (user_role === 'production_manager') {
    // 生产跟单只能查看自己负责的订单的跟进记录
    query = `
      SELECT 
        f.*,
        u.username as production_manager_name,
        o.order_number
      FROM order_follow_ups f
      LEFT JOIN users u ON f.production_manager_id = u.id
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE f.order_id = $1 AND o.assigned_to = $2
      ORDER BY f.created_at DESC
    `;
    params = [order_id, user_id];
  } else {
    // 客户只能查看标记为可见的跟进记录
    query = `
      SELECT 
        f.*,
        u.username as production_manager_name,
        o.order_number
      FROM order_follow_ups f
      LEFT JOIN users u ON f.production_manager_id = u.id
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE f.order_id = $1 
        AND f.is_visible_to_customer = true
        AND o.customer_id = $2
      ORDER BY f.created_at DESC
    `;
    params = [order_id, user_id];
  }

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * 获取跟进记录详情
 */
export const getFollowUpById = async (
  id: number,
  user_role?: string,
  user_id?: number
): Promise<FollowUp | null> => {
  let query: string;
  let params: any[];

  if (user_role === 'admin') {
    query = `
      SELECT 
        f.*,
        u.username as production_manager_name,
        o.order_number
      FROM order_follow_ups f
      LEFT JOIN users u ON f.production_manager_id = u.id
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE f.id = $1
    `;
    params = [id];
  } else if (user_role === 'production_manager') {
    query = `
      SELECT 
        f.*,
        u.username as production_manager_name,
        o.order_number
      FROM order_follow_ups f
      LEFT JOIN users u ON f.production_manager_id = u.id
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE f.id = $1 AND (f.production_manager_id = $2 OR o.assigned_to = $2)
    `;
    params = [id, user_id];
  } else {
    query = `
      SELECT 
        f.*,
        u.username as production_manager_name,
        o.order_number
      FROM order_follow_ups f
      LEFT JOIN users u ON f.production_manager_id = u.id
      LEFT JOIN orders o ON f.order_id = o.id
      WHERE f.id = $1 
        AND f.is_visible_to_customer = true
        AND o.customer_id = $2
    `;
    params = [id, user_id];
  }

  const result = await pool.query(query, params);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * 更新跟进记录
 */
export const updateFollowUp = async (
  id: number,
  production_manager_id: number,
  updates: {
    content?: string;
    is_visible_to_customer?: boolean;
  }
): Promise<FollowUp> => {
  const { content, is_visible_to_customer } = updates;
  const updatesList: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (content !== undefined) {
    updatesList.push(`content = $${paramIndex++}`);
    values.push(content);
  }

  if (is_visible_to_customer !== undefined) {
    updatesList.push(`is_visible_to_customer = $${paramIndex++}`);
    values.push(is_visible_to_customer);
  }

  if (updatesList.length === 0) {
    throw new Error('没有要更新的字段');
  }

  values.push(id, production_manager_id);

  const result = await pool.query(
    `UPDATE order_follow_ups
     SET ${updatesList.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${paramIndex++} AND production_manager_id = $${paramIndex++}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error('跟进记录不存在或无权修改');
  }

  return result.rows[0];
};

/**
 * 删除跟进记录
 */
export const deleteFollowUp = async (
  id: number,
  production_manager_id: number
): Promise<void> => {
  const result = await pool.query(
    `DELETE FROM order_follow_ups
     WHERE id = $1 AND production_manager_id = $2
     RETURNING id`,
    [id, production_manager_id]
  );

  if (result.rows.length === 0) {
    throw new Error('跟进记录不存在或无权删除');
  }
};

