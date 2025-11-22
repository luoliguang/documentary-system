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

const normalizeOrderPayload = (data: Partial<Order>) => {
  const cleaned: Record<string, any> = { ...data };

  const nullableDateFields: Array<keyof Order> = [
    'order_date',
    'estimated_ship_date',
    'actual_ship_date',
  ];

  nullableDateFields.forEach((field) => {
    if (field in cleaned && cleaned[field] === '') {
      cleaned[field] = null;
    }
  });

  if (typeof cleaned.actual_ship_date === 'string' && cleaned.actual_ship_date) {
    const [onlyDate] = cleaned.actual_ship_date.split(' ');
    cleaned.actual_ship_date = onlyDate || cleaned.actual_ship_date;
  }

  ['customer_code', 'customer_order_number', 'notes', 'internal_notes'].forEach((field) => {
    if (cleaned[field] === '') {
      delete cleaned[field];
    }
  });

  if (
    'shipping_tracking_numbers' in cleaned &&
    Array.isArray(cleaned.shipping_tracking_numbers)
  ) {
    const filtered = cleaned.shipping_tracking_numbers
      .filter((item: any) => item.number && item.number.trim())
      .map((item: any) => ({
        ...item,
        number: item.number.trim(),
        label: item.label?.trim() || undefined,
      }));

    if (filtered.length === 0) {
      delete cleaned.shipping_tracking_numbers;
    } else {
      cleaned.shipping_tracking_numbers = filtered;
    }
  }

  if ('images' in cleaned && Array.isArray(cleaned.images)) {
    const filtered = cleaned.images.filter((image: string) => !!image);
    if (filtered.length === 0) {
      delete cleaned.images;
    } else {
      cleaned.images = filtered;
    }
  }

  return cleaned;
};

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
    const cleanedData = normalizeOrderPayload(data);
    return api.post('/orders', cleanedData);
  },

  // 更新订单（管理员和生产跟单，具体权限由后端权限配置决定）
  updateOrder: (id: number, data: Partial<Order>): Promise<{ message: string; order: Order }> => {
    const cleanedData: any = normalizeOrderPayload(data);

    if ('estimated_ship_date' in data && data.estimated_ship_date === undefined) {
      cleanedData.estimated_ship_date = null;
    }

    if ('actual_ship_date' in data && data.actual_ship_date === undefined) {
      cleanedData.actual_ship_date = null;
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
  getCustomers: (params?: { company_id?: number; company_name?: string; search?: string }): Promise<{ customers: any[] }> => {
    return api.get('/orders/customers/list', { params });
  },

  // 获取客户公司列表（仅管理员）
  getCustomerCompanies: (params?: { search?: string }): Promise<{ companies: any[] }> => {
    return api.get('/orders/companies/list', { params });
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

