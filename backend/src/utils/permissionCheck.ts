import { getRolePermissions } from '../services/rolePermissionService.js';
import type { RolePermissionMap } from '../services/rolePermissionService.js';

type PermissionConfig = RolePermissionMap;

/**
 * 检查用户是否有权限执行某个操作
 */
export async function checkPermission(
  role: string,
  resource: string,
  action: string
): Promise<boolean> {
  // 管理员拥有所有权限
  if (role === 'admin') {
    return true;
  }

  try {
    // 从配置表获取权限配置
    const permissions: RolePermissionMap = await getRolePermissions();
    
    if (!permissions) {
      console.warn(`[权限检查] 权限配置不存在，使用默认权限 (${role} -> ${resource}.${action})`);
      return getDefaultPermission(role, resource, action);
    }
    
    if (!permissions[role]) {
      console.warn(`[权限检查] 角色 ${role} 的权限配置不存在，使用默认权限`);
      return getDefaultPermission(role, resource, action);
    }

    const rolePermissions = permissions[role];
    if (!rolePermissions[resource]) {
      console.warn(`[权限检查] 资源 ${resource} 的权限配置不存在 (role: ${role})，使用默认权限`);
      return getDefaultPermission(role, resource, action);
    }

    // 处理可能的类型问题：可能是布尔值、字符串 "true"/"false"、或数字 1/0
    const permissionValue: any = rolePermissions[resource][action];
    let hasPermission = false;
    
    if (typeof permissionValue === 'boolean') {
      hasPermission = permissionValue === true;
    } else if (typeof permissionValue === 'string') {
      hasPermission = permissionValue.toLowerCase() === 'true' || permissionValue === '1';
    } else if (typeof permissionValue === 'number') {
      hasPermission = permissionValue === 1;
    } else {
      hasPermission = Boolean(permissionValue);
    }
    
    // 只在权限检查失败时记录日志
    if (!hasPermission) {
      console.log(`[权限检查] ${role} -> ${resource}.${action} = false (值: ${permissionValue}, 类型: ${typeof permissionValue})`);
    }
    
    return hasPermission;
  } catch (error) {
    console.error(`[权限检查] 错误 (${role} -> ${resource}.${action}):`, error);
    // 如果配置读取失败，使用默认权限
    return getDefaultPermission(role, resource, action);
  }
}

/**
 * 获取默认权限（作为后备）
 */
function getDefaultPermission(role: string, resource: string, action: string): boolean {
  const defaultPermissions: PermissionConfig = {
    customer_service: {
      orders: {
        can_view_all: true,
        can_view_assigned: true,
        can_view_own: true,
        can_create: true,
        can_update: true,
        can_delete: true,
        can_assign: true,
        can_update_completed: true,
        can_update_can_ship: true,
        can_update_estimated_ship_date: true,
        can_update_notes: true,
        can_update_status: true,
        can_update_order_type: true,
        can_view_internal_notes: true,
      },
      reminders: {
        can_view_all: true,
        can_update: true,
      },
      users: {
        can_view: true,
        can_create: true,
        can_update: true,
      },
      configs: {
        can_view: false,
        can_update: false,
      },
    },
    production_manager: {
      orders: {
        can_view_assigned: true,
        can_update_completed: true,
        can_update_can_ship: true,
        can_update_estimated_ship_date: true,
        can_update_notes: true,
        can_update_status: false,
        can_update_order_type: false,
        can_view_internal_notes: false,
      },
      reminders: {
        can_view_assigned: true,
        can_create: false,
        can_update: false,
        can_delete: false,
      },
    },
    customer: {
      orders: {
        can_view_own: true,
        can_create: true,
        can_update: false,
      },
    },
  };

  return defaultPermissions[role]?.[resource]?.[action] === true;
}

/**
 * 检查生产跟单是否可以更新订单的特定字段
 */
export async function canUpdateOrderField(
  role: string,
  field: string
): Promise<boolean> {
  if (role === 'admin') {
    return true;
  }

  if (role === 'customer') {
    return false;
  }

  if (role === 'production_manager') {
    // 映射字段名到权限动作
    const fieldPermissionMap: Record<string, string> = {
      'is_completed': 'can_update_completed',
      'can_ship': 'can_update_can_ship',
      'estimated_ship_date': 'can_update_estimated_ship_date',
      'notes': 'can_update_notes',
      'status': 'can_update_status',
      'order_type': 'can_update_order_type',
      'internal_notes': 'can_view_internal_notes', // 这个实际上是查看权限
    };

    const permission = fieldPermissionMap[field];
    if (!permission) {
      // 未知字段，默认不允许
      console.warn(`未知字段 ${field}，默认不允许更新`);
      return false;
    }

    const canUpdate = await checkPermission(role, 'orders', permission);
    if (!canUpdate) {
      console.warn(`[字段权限检查] ${role} 无法更新字段 ${field} (权限: ${permission})`);
    }
    return canUpdate;
  }

  return false;
}

