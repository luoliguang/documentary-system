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

  // 更新订单（仅管理员）
  updateOrder: (id: number, data: Partial<Order>): Promise<{ message: string; order: Order }> => {
    return api.put(`/orders/${id}`, data);
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
    assigned_to?: number
  ): Promise<{ message: string; order: Order }> => {
    return api.post(`/orders/${id}/assign`, { assigned_to });
  },

  // 删除订单（仅管理员）
  deleteOrder: (id: number): Promise<{ message: string }> => {
    return api.delete(`/orders/${id}`);
  },
};

