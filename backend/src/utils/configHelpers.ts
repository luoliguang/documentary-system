import { configService } from '../services/configService.js';
import { ORDER_TYPE_OPTIONS } from '../constants/orderType.js';
import { ORDER_STATUS_OPTIONS } from '../constants/orderStatus.js';

/**
 * 获取订单类型选项
 */
export async function getOrderTypeOptions() {
  try {
    const orderTypes = await configService.getConfig('order_types');
    if (Array.isArray(orderTypes) && orderTypes.length > 0) {
      return orderTypes.map((item: any) => ({
        label: item.label,
        value: item.value,
      }));
    }
  } catch (error) {
    console.error('获取订单类型配置错误:', error);
  }
  
  // 默认值
  return ORDER_TYPE_OPTIONS;
}

/**
 * 获取订单状态选项
 */
export async function getOrderStatusOptions() {
  try {
    const orderStatuses = await configService.getConfig('order_statuses');
    if (Array.isArray(orderStatuses) && orderStatuses.length > 0) {
      return orderStatuses.map((item: any) => ({
        label: item.label,
        value: item.value,
      }));
    }
  } catch (error) {
    console.error('获取订单状态配置错误:', error);
  }
  
  // 默认值
  return ORDER_STATUS_OPTIONS;
}

/**
 * 获取角色选项
 */
export async function getRoleOptions() {
  try {
    const roles = await configService.getConfig('roles');
    if (Array.isArray(roles) && roles.length > 0) {
      return roles.map((item: any) => ({
        label: item.label,
        value: item.value,
      }));
    }
  } catch (error) {
    console.error('获取角色配置错误:', error);
  }
  
  // 默认值
  return [
    { label: '管理员', value: 'admin' },
    { label: '生产跟单', value: 'production_manager' },
    { label: '客户', value: 'customer' },
  ];
}

