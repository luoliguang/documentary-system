import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Order, Pagination } from '../types';
import { ordersApi } from '../api/orders';

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([]);
  const currentOrder = ref<Order | null>(null);
  const pagination = ref<Pagination>({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  const loading = ref(false);

  // 获取订单列表
  const fetchOrders = async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    is_completed?: boolean;
    can_ship?: boolean;
    customer_id?: number;
    customer_code?: string;
  }) => {
    loading.value = true;
    try {
      const response = await ordersApi.getOrders(params);
      orders.value = response.orders;
      pagination.value = response.pagination;
      return response;
    } catch (error) {
      throw error;
    } finally {
      loading.value = false;
    }
  };

  // 获取订单详情
  const fetchOrderById = async (id: number) => {
    loading.value = true;
    try {
      const response = await ordersApi.getOrderById(id);
      currentOrder.value = response.order;
      return response.order;
    } catch (error) {
      throw error;
    } finally {
      loading.value = false;
    }
  };

  // 完成任务
  const completeOrder = async (id: number, notes?: string) => {
    try {
      const response = await ordersApi.completeOrder(id, notes);
      // 更新本地订单状态
      const index = orders.value.findIndex((o) => o.id === id);
      if (index !== -1) {
        orders.value[index] = response.order;
      }
      if (currentOrder.value?.id === id) {
        currentOrder.value = response.order;
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  // 更新订单
  const updateOrder = async (id: number, data: Partial<Order>) => {
    try {
      const response = await ordersApi.updateOrder(id, data);
      // 更新本地订单
      const index = orders.value.findIndex((o) => o.id === id);
      if (index !== -1) {
        orders.value[index] = response.order;
      }
      if (currentOrder.value?.id === id) {
        currentOrder.value = response.order;
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  return {
    orders,
    currentOrder,
    pagination,
    loading,
    fetchOrders,
    fetchOrderById,
    completeOrder,
    updateOrder,
  };
});

