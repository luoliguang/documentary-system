import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { notificationsApi, type Notification } from '../api/notifications';
import { ElMessage } from 'element-plus';

export const useNotificationsStore = defineStore('notifications', () => {
  const unreadCount = ref(0);
  const notifications = ref<Notification[]>([]);
  const loading = ref(false);
  const pollingInterval = ref<NodeJS.Timeout | null>(null);
  const lastFetchParams = ref<{
    page?: number;
    pageSize?: number;
    is_read?: boolean;
    type?: string;
  } | null>(null);

  // 计算属性：是否有未读通知
  const hasUnread = computed(() => unreadCount.value > 0);

  /**
   * 获取未读通知数量
   */
  const fetchUnreadCount = async () => {
    try {
      const previousCount = unreadCount.value;
      const response = await notificationsApi.getUnreadCount();
      unreadCount.value = response.count;

      // 如果未读数量增加，自动刷新最新通知列表
      if (
        response.count > previousCount &&
        (lastFetchParams.value || notifications.value.length > 0)
      ) {
        const params =
          lastFetchParams.value || {
            page: 1,
            pageSize: 20,
          };
        await fetchNotifications(params);
      }
    } catch (error) {
      console.error('获取未读通知数量失败:', error);
    }
  };

  /**
   * 获取通知列表
   */
  const fetchNotifications = async (params?: {
    page?: number;
    pageSize?: number;
    is_read?: boolean;
    type?: string;
  }) => {
    loading.value = true;
    try {
        const paramsWithDefault = {
          page: params?.page ?? 1,
          pageSize: params?.pageSize ?? 20,
          is_read: params?.is_read,
          type: params?.type,
        };
        lastFetchParams.value = paramsWithDefault;

        const response = await notificationsApi.getNotifications(paramsWithDefault);
      notifications.value = response.notifications;
      return response;
    } catch (error) {
      ElMessage.error('获取通知列表失败');
      throw error;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 标记通知为已读
   */
  const markAsRead = async (id: number) => {
    try {
      await notificationsApi.markAsRead(id);
      // 更新本地状态
      const notification = notifications.value.find((n) => n.id === id);
      if (notification) {
        notification.is_read = true;
        notification.read_at = new Date().toISOString();
      }
      // 更新未读数量
      if (unreadCount.value > 0) {
        unreadCount.value--;
      }
    } catch (error) {
      ElMessage.error('标记通知为已读失败');
      throw error;
    }
  };

  /**
   * 标记所有通知为已读
   */
  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      // 更新本地状态
      notifications.value.forEach((n) => {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      });
      unreadCount.value = 0;
      ElMessage.success('所有通知已标记为已读');
    } catch (error) {
      ElMessage.error('标记所有通知为已读失败');
      throw error;
    }
  };

  /**
   * 开始轮询未读数量（每30秒）
   */
  const startPolling = () => {
    // 先立即获取一次
    fetchUnreadCount();
    
    // 清除之前的轮询
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
    }

    // 设置新的轮询
    pollingInterval.value = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // 30秒
  };

  /**
   * 停止轮询
   */
  const stopPolling = () => {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
      pollingInterval.value = null;
    }
  };

  /**
   * 删除通知
   */
  const deleteNotification = async (id: number) => {
    try {
      // 先找到要删除的通知，检查是否为未读
      const notification = notifications.value.find((n) => n.id === id);
      const wasUnread = notification && !notification.is_read;
      
      await notificationsApi.deleteNotification(id);
      
      // 从本地列表中移除
      const index = notifications.value.findIndex((n) => n.id === id);
      if (index !== -1) {
        notifications.value.splice(index, 1);
      }
      
      // 如果删除的是未读通知，更新未读数量
      if (wasUnread && unreadCount.value > 0) {
        unreadCount.value--;
      }
    } catch (error) {
      ElMessage.error('删除通知失败');
      throw error;
    }
  };

  /**
   * 批量删除通知
   */
  const deleteNotificationsBatch = async (ids: number[]) => {
    if (ids.length === 0) {
      ElMessage.warning('请选择要删除的通知');
      return;
    }

    try {
      const response = await notificationsApi.deleteNotificationsBatch(ids);
      
      // 统计删除的未读通知数量
      let unreadDeletedCount = 0;
      ids.forEach((id) => {
        const notification = notifications.value.find((n) => n.id === id);
        if (notification && !notification.is_read) {
          unreadDeletedCount++;
        }
      });
      
      // 从本地列表中移除
      notifications.value = notifications.value.filter((n) => !ids.includes(n.id));
      
      // 更新未读计数
      unreadCount.value = Math.max(0, unreadCount.value - unreadDeletedCount);
      
      ElMessage.success(response.message || `成功删除 ${response.deleted_count} 条通知`);
    } catch (error) {
      ElMessage.error('批量删除通知失败');
      throw error;
    }
  };

  /**
   * 按订单标记相关通知为已读
   */
  const markOrderNotificationsAsRead = async (orderId: number) => {
    try {
      const response = await notificationsApi.markOrderNotificationsAsRead(orderId);
      const markedCount = response.count;

      notifications.value.forEach((notification) => {
        if (
          notification.related_type === 'order' &&
          notification.related_id === orderId
        ) {
          notification.is_read = true;
          notification.read_at = new Date().toISOString();
        }
      });

      if (markedCount > 0 && unreadCount.value > 0) {
        unreadCount.value = Math.max(unreadCount.value - markedCount, 0);
      }
    } catch (error) {
      console.error('按订单标记通知为已读失败:', error);
    }
  };

  /**
   * 重置状态
   */
  const reset = () => {
    unreadCount.value = 0;
    notifications.value = [];
    stopPolling();
  };

  return {
    unreadCount,
    notifications,
    loading,
    hasUnread,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteNotificationsBatch,
    markOrderNotificationsAsRead,
    startPolling,
    stopPolling,
    reset,
  };
});

