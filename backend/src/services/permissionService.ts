/**
 * 权限服务层
 * 集中管理所有权限检查逻辑，避免在业务代码中散落权限判断
 */

import { pool } from '../config/database.js';
import { checkPermission, canUpdateOrderField } from '../utils/permissionCheck.js';
import { AuthRequest } from '../middleware/auth.js';
import { getRolePermissions } from './rolePermissionService.js';
import { getUserPermissionOverrides } from './userPermissionOverrideService.js';
import { isOrderAssignedToUser } from './orderAssignmentService.js';

export interface DataAccessFilter {
  whereConditions: string[];
  params: any[];
  paramIndex: number;
}

/**
 * 检查用户是否可以访问订单
 */
const ADMIN_LIKE_ROLES = new Set(['admin', 'customer_service']);
const isAdminLikeRole = (role: string) => ADMIN_LIKE_ROLES.has(role);

export async function canAccessOrder(
  userId: number,
  role: string,
  orderId: number
): Promise<boolean> {
  if (isAdminLikeRole(role)) {
    return true;
  }

  if (role === 'customer') {
    // 客户可以访问同一公司的所有订单
    const result = await pool.query(
      `SELECT o.id 
       FROM orders o
       INNER JOIN users u ON o.customer_id = u.id
       WHERE o.id = $1 AND u.company_id = (SELECT company_id FROM users WHERE id = $2)`,
      [orderId, userId]
    );
    return result.rows.length > 0;
  }

  if (role === 'production_manager') {
    const assigned = await isOrderAssignedToUser(orderId, userId);
    if (assigned) {
      return true;
    }

    // 检查订单类型是否在分配的类型中
    try {
      const assignedTypes = await getProductionManagerOrderTypes(userId);
      const enforceTypeCheck = assignedTypes.length > 0;
      const orderResult = await pool.query(
        'SELECT order_type FROM orders WHERE id = $1',
        [orderId]
      );
      if (orderResult.rows.length > 0) {
        const orderType = orderResult.rows[0].order_type;
        if (!enforceTypeCheck) {
          return true;
        }
        if (orderType && assignedTypes.includes(orderType)) {
          return true;
        }
      }
    } catch (error) {
      console.error('检查生产跟单订单类型权限错误:', error);
    }

    return false;
  }

  return false;
}

/**
 * 为订单查询构建数据访问过滤器
 * 根据用户角色自动添加WHERE条件，实现数据隔离
 */
export async function buildOrderDataAccessFilter(
  userId: number,
  role: string
): Promise<DataAccessFilter> {
  const whereConditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (isAdminLikeRole(role)) {
    // 管理员可以查看所有订单，不需要添加WHERE条件
    return { whereConditions, params, paramIndex };
  }

  if (role === 'customer') {
    // 客户可以查看同一公司的所有订单
    whereConditions.push(`o.company_id = (SELECT company_id FROM users WHERE id = $${paramIndex++})`);
    params.push(userId);
    return { whereConditions, params, paramIndex };
  }

  if (role === 'production_manager') {
    // 生产跟单只能查看分配给自己的订单
    whereConditions.push(
      `(o.assigned_to = $${paramIndex++} OR EXISTS (SELECT 1 FROM order_assignments oa WHERE oa.order_id = o.id AND oa.production_manager_id = $${paramIndex++}))`
    );
    params.push(userId, userId);
    
    // 检查订单类型权限（如果用户有分配的类型）
    try {
      const userResult = await pool.query(
        'SELECT assigned_order_types FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        const assignedTypes = userResult.rows[0].assigned_order_types || [];
        if (Array.isArray(assignedTypes) && assignedTypes.length > 0) {
          // 如果指定了订单类型，需要确保在分配的范围内
          // 这个检查在调用方处理，因为需要从req.query获取order_type
        }
      }
    } catch (error: any) {
      // 如果字段不存在，忽略
      if (error.code !== '42703') {
        console.error('检查生产跟单订单类型权限错误:', error);
      }
    }
    
    return { whereConditions, params, paramIndex };
  }

  // 未知角色，拒绝访问
  whereConditions.push('1 = 0'); // 永远不匹配的条件
  return { whereConditions, params, paramIndex };
}

/**
 * 检查用户是否可以创建订单
 */
export async function canCreateOrder(role: string): Promise<boolean> {
  if (role === 'admin') {
    return true;
  }
  return await checkPermission(role, 'orders', 'can_create');
}

/**
 * 检查用户是否可以更新订单
 */
export async function canUpdateOrder(
  userId: number,
  role: string,
  orderId: number
): Promise<boolean> {
  if (isAdminLikeRole(role)) {
    return true;
  }

  if (role === 'customer') {
    // 客户不能更新订单（除了客户订单编号）
    return false;
  }

  if (role === 'production_manager') {
    const canAccess = await canAccessOrder(userId, role, orderId);
    if (!canAccess) {
      return false;
    }
    // 生产跟单可以更新部分字段（通过canUpdateOrderField检查）
    return true;
  }

  return false;
}

/**
 * 检查用户是否可以更新订单字段
 */
export async function canUpdateOrderFieldByRole(
  role: string,
  field: string
): Promise<boolean> {
  if (isAdminLikeRole(role)) {
    return true;
  }

  // 以下字段只有管理员可以更新
  const adminOnlyFields = [
    'order_number',
    'customer_order_number',
    'customer_id',
    'images',
    'order_date',
    'actual_ship_date',
    'internal_notes',
    'shipping_tracking_numbers',
  ];

  if (adminOnlyFields.includes(field)) {
    return false;
  }

  // 其他字段通过权限配置检查
  return await canUpdateOrderField(role, field);
}

/**
 * 检查用户是否可以删除订单
 */
export async function canDeleteOrder(role: string): Promise<boolean> {
  if (isAdminLikeRole(role)) {
    return true;
  }
  return await checkPermission(role, 'orders', 'can_delete');
}

/**
 * 检查用户是否可以创建跟进记录
 */
export async function canCreateFollowUp(
  userId: number,
  role: string,
  orderId: number
): Promise<boolean> {
  if (role !== 'production_manager') {
    return false;
  }

  return await isOrderAssignedToUser(orderId, userId);
}

/**
 * 检查用户是否可以访问跟进记录
 */
export async function canAccessFollowUp(
  userId: number,
  role: string,
  followUpId: number
): Promise<boolean> {
  if (isAdminLikeRole(role)) {
    return true;
  }

  // 查询跟进记录
  const result = await pool.query(
    `SELECT f.production_manager_id, o.customer_id, f.order_id
     FROM order_follow_ups f
     LEFT JOIN orders o ON f.order_id = o.id
     WHERE f.id = $1`,
    [followUpId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const followUp = result.rows[0];

  if (role === 'production_manager') {
    // 生产跟单只能访问自己创建的跟进记录，或分配给自己的订单的跟进记录
    return (
      followUp.production_manager_id === userId ||
      (await isOrderAssignedToUser(followUp.order_id, userId))
    );
  }

  if (role === 'customer') {
    // 客户可以查看同一公司的订单的跟进记录（标记为可见的）
    // 检查订单是否属于同一公司
    const userResult = await pool.query(
      'SELECT company_id FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return false;
    }
    const userCompanyId = userResult.rows[0].company_id;
    
    // 获取订单的公司ID
    const orderResult = await pool.query(
      'SELECT company_id FROM orders WHERE id = $1',
      [followUp.order_id]
    );
    if (orderResult.rows.length === 0) {
      return false;
    }
    const orderCompanyId = orderResult.rows[0].company_id;
    
    // 检查是否属于同一公司
    if (userCompanyId === null || orderCompanyId === null || userCompanyId !== orderCompanyId) {
      return false;
    }
    
    // 还需要检查is_visible_to_customer，但这个在查询时处理
    return true;
  }

  return false;
}

/**
 * 检查用户是否可以创建催货记录
 */
export async function canCreateReminder(
  userId: number,
  role: string,
  orderId: number
): Promise<boolean> {
  if (role !== 'customer') {
    return false;
  }

  // 检查订单是否属于该客户的公司
  const result = await pool.query(
    `SELECT o.company_id 
     FROM orders o
     WHERE o.id = $1`,
    [orderId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const orderCompanyId = result.rows[0].company_id;
  if (orderCompanyId === null) {
    return false;
  }

  // 检查用户的公司ID是否匹配
  const userResult = await pool.query(
    'SELECT company_id FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return false;
  }

  return userResult.rows[0].company_id === orderCompanyId;
}

/**
 * 检查用户是否可以回复催货记录
 */
export async function canRespondReminder(role: string): Promise<boolean> {
  if (role === 'admin') {
    return true;
  }
  return await checkPermission(role, 'reminders', 'can_update');
}

/**
 * 获取生产跟单的订单类型权限
 */
export async function getProductionManagerOrderTypes(
  userId: number
): Promise<string[]> {
  try {
    const overrideTypes = await getUserAllowedOrderTypes(userId);
    if (overrideTypes.length > 0) {
      return overrideTypes;
    }

    const userResult = await pool.query(
      'SELECT assigned_order_types FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length > 0) {
      const assignedTypes = userResult.rows[0].assigned_order_types;
      if (Array.isArray(assignedTypes) && assignedTypes.length > 0) {
        return assignedTypes;
      }
    }
    const roleTypes = await getRoleAllowedOrderTypes('production_manager');
    if (roleTypes.length > 0) {
      return roleTypes;
    }
  } catch (error: any) {
    // 如果字段不存在，返回空数组
    if (error.code === '42703') {
      return [];
    }
    console.error('获取生产跟单订单类型权限错误:', error);
  }
  return [];
}

async function getRoleAllowedOrderTypes(role: string): Promise<string[]> {
  try {
    const rolePermissions = await getRolePermissions();
    const allowedTypes =
      rolePermissions?.[role]?.orders?.allowed_order_types || [];
    if (Array.isArray(allowedTypes)) {
      return allowedTypes;
    }
  } catch (error) {
    console.error('获取角色订单类型权限失败:', error);
  }
  return [];
}

/**
 * 检查生产跟单是否可以查看指定类型的订单
 */
export async function canViewOrderType(
  userId: number,
  orderType: string
): Promise<boolean> {
  const assignedTypes = await getProductionManagerOrderTypes(userId);
  if (!assignedTypes.length) {
    return true;
  }
  return assignedTypes.includes(orderType);
}

async function getUserAllowedOrderTypes(userId: number): Promise<string[]> {
  try {
    const overrides = await getUserPermissionOverrides(userId);
    const allowedTypes =
      overrides?.orders?.allowed_order_types ||
      overrides?.orders?.allowedOrderTypes;
    if (Array.isArray(allowedTypes)) {
      return allowedTypes;
    }
  } catch (error) {
    console.error('解析用户权限覆盖失败:', error);
  }
  return [];
}

