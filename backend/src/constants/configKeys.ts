/**
 * 配置键常量
 * 统一管理所有配置键，避免硬编码
 */

export const CONFIG_KEYS = {
  // 通用配置
  REMINDER_MIN_INTERVAL_HOURS: 'reminder_min_interval_hours',
  DEFAULT_PAGE_SIZE: 'default_page_size',
  
  // 订单配置
  ORDER_TYPES: 'order_types',
  ORDER_STATUSES: 'order_statuses',
  
  // 权限配置
  ROLES: 'roles',
  ROLE_PERMISSIONS: 'role_permissions',
  CONFIG_PERMISSIONS: 'config_permissions',
  CUSTOMER_ROLES: 'customer_roles',
  
  // 分配规则
  ASSIGNMENT_RULES: 'assignment_rules',
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

