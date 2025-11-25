/**
 * 订单操作日志服务
 * 统一管理订单操作日志的创建和查询
 */

import { pool } from '../config/database.js';
import { emitOrderActivityAdded } from '../websocket/emitter.js';

export type ActionType =
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'updated'
  | 'note_added'
  | 'internal_note_added'
  | 'reminder_replied'
  | 'reminder_transferred'
  | 'permission_request_submitted'
  | 'completed'
  | 'can_ship'
  | 'shipped'
  | 'follow_up_added'
  | 'customer_order_number_updated'
  | 'estimated_ship_date_updated'
  | 'images_updated'
  | 'tracking_numbers_updated';

export interface OrderActivity {
  id: number;
  order_id: number;
  user_id: number | null;
  action_type: ActionType;
  action_text: string;
  extra_data: Record<string, any>;
  is_visible_to_customer: boolean;
  created_at: Date;
  // 关联数据
  username?: string;
  user_role?: string;
}

export interface CreateActivityParams {
  orderId: number;
  userId: number | null;
  actionType: ActionType;
  actionText: string;
  extraData?: Record<string, any>;
  isVisibleToCustomer?: boolean;
}

/**
 * 创建订单操作日志
 */
export async function addOrderActivity(
  params: CreateActivityParams
): Promise<OrderActivity> {
  const {
    orderId,
    userId,
    actionType,
    actionText,
    extraData = {},
    isVisibleToCustomer,
  } = params;
  
  // 根据操作类型智能判断默认可见性
  // 如果未指定，则根据操作类型决定
  let finalVisibleToCustomer = isVisibleToCustomer;
  if (isVisibleToCustomer === undefined) {
    // 默认对客户可见的操作类型
    const customerVisibleTypes: ActionType[] = [
      'created',
      'assigned',
      'status_changed',
      'completed',
      'can_ship',
      'shipped',
      'note_added',
      'customer_order_number_updated',
      'estimated_ship_date_updated',
      'images_updated',
      'tracking_numbers_updated',
      'follow_up_added', // 根据 is_visible_to_customer 字段决定
      'reminder_replied',
    ];
    // 默认对客户不可见的操作类型
    const internalOnlyTypes: ActionType[] = [
      'internal_note_added',
      'updated', // 通用更新，默认不可见
      'permission_request_submitted',
    ];
    
    if (customerVisibleTypes.includes(actionType)) {
      finalVisibleToCustomer = true;
    } else if (internalOnlyTypes.includes(actionType)) {
      finalVisibleToCustomer = false;
    } else {
      // 默认可见（向后兼容）
      finalVisibleToCustomer = true;
    }
  }

  const result = await pool.query(
    `INSERT INTO order_activities (
        order_id, user_id, action_type, action_text, 
        extra_data, is_visible_to_customer
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
    [
      orderId,
      userId,
      actionType,
      actionText,
      JSON.stringify(extraData),
      finalVisibleToCustomer,
    ]
  );

  const activity = result.rows[0];

  // 实时推送
  try {
    emitOrderActivityAdded(activity);
  } catch (error) {
    console.error('推送订单操作日志失败:', error);
    // 推送失败不影响日志记录
  }

  return activity;
}

/**
 * 获取订单的操作日志列表
 */
export async function getOrderActivities(
  orderId: number,
  options: {
    userRole?: string;
    userId?: number;
  } = {}
): Promise<OrderActivity[]> {
  const { userRole, userId } = options;

  let query: string;
  let params: any[];

  if (userRole === 'admin' || userRole === 'customer_service') {
    // 管理员和客服可以查看所有日志
    query = `
      SELECT 
        a.*,
        u.username,
        u.role as user_role
      FROM order_activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.order_id = $1
      ORDER BY a.created_at DESC
    `;
    params = [orderId];
  } else if (userRole === 'production_manager') {
    // 生产跟单可以查看所有日志
    query = `
      SELECT 
        a.*,
        u.username,
        u.role as user_role
      FROM order_activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.order_id = $1
      ORDER BY a.created_at DESC
    `;
    params = [orderId];
  } else {
    // 客户只能查看标记为可见的日志
    query = `
      SELECT 
        a.*,
        u.username,
        u.role as user_role
      FROM order_activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.order_id = $1 
        AND a.is_visible_to_customer = true
      ORDER BY a.created_at DESC
    `;
    params = [orderId];
  }

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * 手动创建订单操作日志（管理员功能）
 */
export async function createManualActivity(
  orderId: number,
  userId: number,
  actionText: string,
  isVisibleToCustomer: boolean = true
): Promise<OrderActivity> {
  return addOrderActivity({
    orderId,
    userId,
    actionType: 'note_added',
    actionText,
    isVisibleToCustomer,
  });
}

