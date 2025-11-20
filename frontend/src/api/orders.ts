import api from '../utils/request';
import { Order, OrdersResponse, OrderStatusHistory } from '../types';

interface OrderQueryParams {
  page?: number;
  pageSize?: number;
  order_number?: string;
  customer_order_number?: string;
  status?: string;
  is_completed?: boolean;
  can_ship?: boolean;
  customer_id?: number;
  customer_code?: string;
  company_name?: string;
  estimated_ship_start?: string;
  estimated_ship_end?: string;
}

export const ordersApi = {
  // 获取订单列表
  getOrders: (params?: OrderQueryParams): Promise<OrdersResponse> => {
    return api.get('/orders', { params });
  },

  // 获取订单详情
  getOrderById: (id: number): Promise<{ order: Order }> => {
    return api.get(`/orders/${id}`);
  },

  // 创建订单（仅管理员）
  createOrder: (data: Partial<Order>): Promise<{ message: string; order: Order }> => {
    return api.post('/orders', data);
  },

  // 更新订单（管理员和生产跟单，具体权限由后端权限配置决定）
  updateOrder: (id: number, data: Partial<Order>): Promise<{ message: string; order: Order }> => {
    // 确保清除日期时传递 null 而不是 undefined
    // 如果 estimated_ship_date 在 data 中且值为 null，明确传递 null
    const cleanedData: any = { ...data };

    const nullableDateFields: Array<keyof Order> = [
      'order_date',
      'estimated_ship_date',
      'actual_ship_date',
    ];

    nullableDateFields.forEach((field) => {
      if (field in cleanedData && cleanedData[field] === '') {
        cleanedData[field] = null;
      }
    });

    if ('estimated_ship_date' in data) {
      if (data.estimated_ship_date === null) {
        cleanedData.estimated_ship_date = null;
      } else if (data.estimated_ship_date === undefined) {
        // 如果明确设置为 undefined（清除），也传递 null
        cleanedData.estimated_ship_date = null;
      }
      // 如果是有值的情况，保持原样
    }

    if ('actual_ship_date' in cleanedData && typeof cleanedData.actual_ship_date === 'string') {
      const [onlyDate] = cleanedData.actual_ship_date.split(' ');
      cleanedData.actual_ship_date = onlyDate || cleanedData.actual_ship_date;
    }

    if (
      'shipping_tracking_numbers' in cleanedData &&
      Array.isArray(cleanedData.shipping_tracking_numbers)
    ) {
      const filtered = cleanedData.shipping_tracking_numbers.filter(
        (item: any) => item.number && item.number.trim()
      );
      // 如果过滤后为空数组，删除该字段（不发送到后端）
      if (filtered.length === 0) {
        delete cleanedData.shipping_tracking_numbers;
      } else {
        cleanedData.shipping_tracking_numbers = filtered;
      }
    }

    // 处理 images 字段：如果为空数组，删除该字段
    if ('images' in cleanedData && Array.isArray(cleanedData.images)) {
      const filtered = cleanedData.images.filter((image: string) => !!image);
      if (filtered.length === 0) {
        delete cleanedData.images;
      } else {
        cleanedData.images = filtered;
      }
    }

    return api.put(`/orders/${id}`, cleanedData);
  },

  // 完成任务（仅管理员）
  completeOrder: (id: number, notes?: string): Promise<{ message: string; order: Order }> => {
    return api.patch(`/orders/${id}/complete`, { notes });
  },

  // 更新客户订单编号（客户）
  updateCustomerOrderNumber: (
    id: number,
    customer_order_number: string
  ): Promise<{ message: string; order: Order }> => {
    return api.patch(`/orders/${id}/customer-order-number`, {
      customer_order_number,
    });
  },

  // 获取订单状态历史
  getOrderStatusHistory: (id: number): Promise<{ history: OrderStatusHistory[] }> => {
    return api.get(`/orders/${id}/history`);
  },

  // 获取客户列表（仅管理员）
  getCustomers: (): Promise<{ customers: any[] }> => {
    return api.get('/orders/customers/list');
  },

  // 获取生产跟单列表（仅管理员）
  getProductionManagers: (): Promise<{ productionManagers: any[] }> => {
    return api.get('/orders/production-managers/list');
  },

  // 分配订单给生产跟单（仅管理员）
  assignOrder: (
    id: number,
    payload?: number | null | {
      assigned_to_ids?: number[];
      primary_assigned_to?: number | null;
      assigned_to?: number | null;
    }
  ): Promise<{ message: string; order: Order }> => {
    let body: Record<string, any>;
    if (typeof payload === 'number' || payload === null) {
      body = { assigned_to: payload };
    } else if (payload) {
      body = payload;
    } else {
      body = { assigned_to_ids: [] };
    }
    return api.post(`/orders/${id}/assign`, body);
  },

  // 删除订单（仅管理员）
  deleteOrder: (id: number): Promise<{ message: string }> => {
    return api.delete(`/orders/${id}`);
  },
};

