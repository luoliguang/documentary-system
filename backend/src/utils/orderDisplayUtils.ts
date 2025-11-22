/**
 * 订单显示工具函数
 * 用于统一处理订单编号的显示逻辑
 */

/**
 * 获取订单显示编号
 * 根据用户角色和订单信息，返回最合适的订单编号用于显示
 * 
 * 规则：
 * - 客户角色：优先显示客户订单编号，如果为空则显示工厂订单编号
 * - 内部角色（管理员、生产跟单等）：显示工厂订单编号（或同时显示两个编号）
 * 
 * @param orderInfo 订单信息对象，包含 order_number 和 customer_order_number
 * @param userRole 用户角色
 * @param options 可选配置
 * @returns 用于显示的订单编号字符串
 */
export function getOrderDisplayNumber(
  orderInfo: {
    order_number: string;
    customer_order_number?: string | null;
  },
  userRole?: string,
  options?: {
    /**
     * 是否同时显示两个编号（用于内部人员查看）
     * 格式：客户编号（工厂编号）或 工厂编号
     */
    showBoth?: boolean;
    /**
     * 是否显示标签（如"客户订单编号："）
     */
    showLabel?: boolean;
  }
): string {
  const { order_number, customer_order_number } = orderInfo;
  const { showBoth = false, showLabel = false } = options || {};
  
  const isCustomer = userRole === 'customer';
  const hasCustomerNumber = customer_order_number && customer_order_number.trim() !== '';
  
  // 客户角色：优先显示客户订单编号
  if (isCustomer) {
    if (hasCustomerNumber) {
      return showLabel 
        ? `客户订单编号：${customer_order_number}` 
        : customer_order_number;
    } else {
      return showLabel 
        ? `工厂订单编号：${order_number}` 
        : order_number;
    }
  }
  
  // 内部角色
  if (showBoth) {
    // 同时显示两个编号
    if (hasCustomerNumber) {
      return showLabel
        ? `客户订单编号：${customer_order_number}（工厂编号：${order_number}）`
        : `${customer_order_number}（${order_number}）`;
    } else {
      return showLabel
        ? `工厂订单编号：${order_number}`
        : order_number;
    }
  } else {
    // 只显示工厂编号（内部人员主要使用工厂编号）
    return showLabel
      ? `工厂订单编号：${order_number}`
      : order_number;
  }
}

/**
 * 获取订单显示编号（简化版，用于通知标题）
 * 客户优先看到客户编号，内部人员看到工厂编号
 */
export function getOrderDisplayNumberSimple(
  orderInfo: {
    order_number: string;
    customer_order_number?: string | null;
  },
  userRole?: string
): string {
  const { order_number, customer_order_number } = orderInfo;
  const isCustomer = userRole === 'customer';
  const hasCustomerNumber = customer_order_number && customer_order_number.trim() !== '';
  
  if (isCustomer && hasCustomerNumber) {
    return customer_order_number;
  }
  
  return order_number;
}

/**
 * 获取订单完整显示信息（用于通知内容）
 * 包含客户编号和工厂编号的完整信息
 */
export function getOrderDisplayInfo(
  orderInfo: {
    order_number: string;
    customer_order_number?: string | null;
  },
  userRole?: string
): string {
  const { order_number, customer_order_number } = orderInfo;
  const isCustomer = userRole === 'customer';
  const hasCustomerNumber = customer_order_number && customer_order_number.trim() !== '';
  
  if (isCustomer) {
    // 客户看到：客户编号（如果有），工厂编号作为补充
    if (hasCustomerNumber) {
      return `客户订单编号：${customer_order_number}${order_number !== customer_order_number ? `（工厂编号：${order_number}）` : ''}`;
    } else {
      return `工厂订单编号：${order_number}`;
    }
  } else {
    // 内部人员看到：工厂编号（主要），客户编号作为补充
    if (hasCustomerNumber) {
      return `工厂订单编号：${order_number}（客户编号：${customer_order_number}）`;
    } else {
      return `工厂订单编号：${order_number}`;
    }
  }
}

