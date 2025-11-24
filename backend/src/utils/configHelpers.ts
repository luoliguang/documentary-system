import { configService } from '../services/configService.js';
import { CONFIG_KEYS } from '../constants/configKeys.js';
import { cacheService } from '../services/cacheService.js';

const ORDER_STATUS_CACHE_KEY = 'config:order-status';
const ORDER_TYPE_CACHE_KEY = 'config:order-type';
const ROLE_OPTIONS_CACHE_KEY = 'config:roles';
const CUSTOMER_ROLE_CACHE_KEY = 'config:customer-roles';
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * 获取订单类型选项
 */
export async function getOrderTypeOptions() {
  const cached = await cacheService.getJson<string[]>(ORDER_TYPE_CACHE_KEY);
  if (cached) {
    return cached;
  }
  const orderTypes = (await configService.getConfig(CONFIG_KEYS.ORDER_TYPES)) || [];
  await cacheService.setJson(ORDER_TYPE_CACHE_KEY, orderTypes, THIRTY_DAYS_SECONDS);
  return orderTypes;
}

/**
 * 获取订单状态选项
 */
export async function getOrderStatusOptions() {
  const cached = await cacheService.getJson<string[]>(ORDER_STATUS_CACHE_KEY);
  if (cached) {
    return cached;
  }
  const orderStatuses = (await configService.getConfig(CONFIG_KEYS.ORDER_STATUSES)) || [];
  await cacheService.setJson(
    ORDER_STATUS_CACHE_KEY,
    orderStatuses,
    THIRTY_DAYS_SECONDS
  );
  return orderStatuses;
}

/**
 * 获取角色选项
 */
export async function getRoleOptions() {
  const cached = await cacheService.getJson<string[]>(ROLE_OPTIONS_CACHE_KEY);
  if (cached) {
    return cached;
  }
  const roles = (await configService.getConfig(CONFIG_KEYS.ROLES)) || [];
  await cacheService.setJson(ROLE_OPTIONS_CACHE_KEY, roles, THIRTY_DAYS_SECONDS);
  return roles;
}

/**
 * 获取需要视为客户的角色列表
 */
export async function getCustomerRoleValues(): Promise<string[]> {
  const cached = await cacheService.getJson<string[]>(CUSTOMER_ROLE_CACHE_KEY);
  if (cached && cached.length > 0) {
    return cached;
  }
  const configured = await configService.getConfig(CONFIG_KEYS.CUSTOMER_ROLES);
  if (Array.isArray(configured)) {
    const normalized = configured
      .map((role) => (typeof role === 'string' ? role.trim() : ''))
      .filter((role) => role.length > 0);
    if (normalized.length > 0) {
      await cacheService.setJson(
        CUSTOMER_ROLE_CACHE_KEY,
        normalized,
        THIRTY_DAYS_SECONDS
      );
      return normalized;
    }
  }
  const fallback = ['customer'];
  await cacheService.setJson(
    CUSTOMER_ROLE_CACHE_KEY,
    fallback,
    THIRTY_DAYS_SECONDS
  );
  return fallback;
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
