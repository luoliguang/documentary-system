import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { Order, Pagination } from '../types';
import { ordersApi } from '../api/orders';
import { connectWebSocket } from '../utils/websocket';

type OrderQuery = {
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
};

export const useOrdersStore = defineStore(
  'orders',
  () => {
    const orders = ref<Order[]>([]);
    const currentOrder = ref<Order | null>(null);
    const pagination = ref<Pagination>({
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
    const loading = ref(false);
    const lastQueryKey = ref<string | null>(null);
    const isLoading = computed(() => loading.value);

    const serializeParams = (params?: OrderQuery) =>
      JSON.stringify(params ? Object.entries(params).sort() : []);

    const fetchOrders = async (
      params?: OrderQuery,
      options: { force?: boolean } = {}
    ) => {
      const queryKey = serializeParams(params);
      if (!options.force) {
        if (loading.value) {
          return { orders: orders.value, pagination: pagination.value };
        }
        if (orders.value.length > 0 && lastQueryKey.value === queryKey) {
          return { orders: orders.value, pagination: pagination.value };
        }
      }

      loading.value = true;
      try {
        const response = await ordersApi.getOrders(params);
        orders.value = response.orders;
        pagination.value = response.pagination;
        lastQueryKey.value = queryKey;
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
      if (!response.order) {
        throw new Error('订单不存在');
      }
      currentOrder.value = response.order;
      return response.order;
    } catch (error) {
      currentOrder.value = null;
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

  // 删除订单
  const deleteOrder = async (id: number) => {
    try {
      await ordersApi.deleteOrder(id);
      // 从本地列表中移除
      orders.value = orders.value.filter((o) => o.id !== id);
      if (currentOrder.value?.id === id) {
        currentOrder.value = null;
      }
      // 更新分页总数
      if (pagination.value.total > 0) {
        pagination.value.total -= 1;
      }
      return true;
    } catch (error) {
      throw error;
    }
  };

  let orderHandler: ((data: any) => void) | null = null;

  // 初始化实时推送
  const initRealtime = () => {
    if (orderHandler) return; // 避免重复初始化
    
    orderHandler = (data: any) => {
      if (data.type === 'order-updated') {
        const { orderId, order } = data;
        // 更新列表中的订单
        const index = orders.value.findIndex((o) => o.id === orderId);
        if (index !== -1) {
          orders.value[index] = { ...orders.value[index], ...order };
        }
        // 更新当前查看的订单
        if (currentOrder.value?.id === orderId) {
          currentOrder.value = { ...currentOrder.value, ...order };
        }
      }
    };
    
    connectWebSocket(orderHandler);
  };

    return {
      orders,
      currentOrder,
      pagination,
      loading,
      isLoading,
      fetchOrders,
      fetchOrderById,
      completeOrder,
      updateOrder,
      deleteOrder,
      initRealtime,
      lastQueryKey,
    };
  },
  {
    persist: {
      key: 'orders-store',
      paths: ['orders', 'pagination', 'currentOrder', 'lastQueryKey'],
      ttl: 5 * 60 * 1000,
    },
  }
);

