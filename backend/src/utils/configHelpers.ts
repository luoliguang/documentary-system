import { configService } from '../services/configService.js';
import { CONFIG_KEYS } from '../constants/configKeys.js';

/**
 * 获取订单类型选项
 */
export async function getOrderTypeOptions() {
  const orderTypes = await configService.getConfig(CONFIG_KEYS.ORDER_TYPES);
  return orderTypes || [];
}

/**
 * 获取订单状态选项
 */
export async function getOrderStatusOptions() {
  const orderStatuses = await configService.getConfig(CONFIG_KEYS.ORDER_STATUSES);
  return orderStatuses || [];
}

/**
 * 获取角色选项
 */
export async function getRoleOptions() {
  const roles = await configService.getConfig(CONFIG_KEYS.ROLES);
  return roles || [];
}

/**
 * 获取默认分页大小
 */
export async function getDefaultPageSize(): Promise<number> {
  const pageSize = await configService.getConfig(CONFIG_KEYS.DEFAULT_PAGE_SIZE);
  if (typeof pageSize === 'number' && pageSize > 0) {
    return Math.max(1, Math.min(100, pageSize)); // 限制在 1-100 之间
  }
  return 20; // 如果配置无效，返回安全默认值（但应该通过配置系统确保有效）
}

/**
 * 解析并验证分页参数
 */
export async function parsePaginationParams(
  page?: string | number | any,
  pageSize?: string | number | any
): Promise<{ page: number; pageSize: number }> {
  const defaultPageSize = await getDefaultPageSize();
  
  const parsedPage = typeof page === 'string' ? parseInt(page, 10) : (page || 1);
  const parsedPageSize = typeof pageSize === 'string' 
    ? parseInt(pageSize, 10) 
    : (pageSize || defaultPageSize);
  
  return {
    page: Math.max(1, parsedPage || 1),
    pageSize: Math.max(1, Math.min(100, parsedPageSize || defaultPageSize)),
  };
}
