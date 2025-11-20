/**
 * 订单类型常量
 * 统一管理所有订单类型值，避免硬编码
 */

export const ORDER_TYPE = {
  /** 必发 */
  REQUIRED: 'required',
  /** 散单 */
  SCATTERED: 'scattered',
  /** 拍照 */
  PHOTO: 'photo',
} as const;

/**
 * 订单类型类型
 */
export type OrderType = typeof ORDER_TYPE[keyof typeof ORDER_TYPE];

/**
 * 订单类型选项（用于下拉框等）
 */
export const ORDER_TYPE_OPTIONS = [
  { value: ORDER_TYPE.REQUIRED, label: '必发' },
  { value: ORDER_TYPE.SCATTERED, label: '散单' },
  { value: ORDER_TYPE.PHOTO, label: '拍照' },
] as const;

/**
 * 验证订单类型是否有效
 */
export function isValidOrderType(type: string): type is OrderType {
  return Object.values(ORDER_TYPE).includes(type as OrderType);
}

/**
 * 获取订单类型标签
 */
export function getOrderTypeLabel(type: OrderType): string {
  const option = ORDER_TYPE_OPTIONS.find(opt => opt.value === type);
  return option?.label || type;
}

