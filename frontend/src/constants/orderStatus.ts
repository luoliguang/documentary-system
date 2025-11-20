/**
 * 订单状态常量
 * 统一管理所有订单状态值，避免硬编码
 */

export const ORDER_STATUS = {
  /** 待处理 */
  PENDING: 'pending',
  /** 已分配 */
  ASSIGNED: 'assigned',
  /** 生产中 */
  IN_PRODUCTION: 'in_production',
  /** 已完成 */
  COMPLETED: 'completed',
  /** 已发货 */
  SHIPPED: 'shipped',
  /** 已取消 */
  CANCELLED: 'cancelled',
} as const;

/**
 * 订单状态类型
 */
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

/**
 * 订单状态选项（用于下拉框等）
 */
export const ORDER_STATUS_OPTIONS = [
  { value: ORDER_STATUS.PENDING, label: '待处理' },
  { value: ORDER_STATUS.ASSIGNED, label: '已分配' },
  { value: ORDER_STATUS.IN_PRODUCTION, label: '生产中' },
  { value: ORDER_STATUS.COMPLETED, label: '已完成' },
  { value: ORDER_STATUS.SHIPPED, label: '已发货' },
  { value: ORDER_STATUS.CANCELLED, label: '已取消' },
] as const;

/**
 * 验证订单状态是否有效
 */
export function isValidOrderStatus(status: string): status is OrderStatus {
  return Object.values(ORDER_STATUS).includes(status as OrderStatus);
}

/**
 * 获取订单状态标签
 */
export function getOrderStatusLabel(status: OrderStatus): string {
  const option = ORDER_STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.label || status;
}

