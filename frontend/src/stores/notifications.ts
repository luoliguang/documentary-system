import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { notificationsApi, type Notification } from '../api/notifications';
import { ElMessage } from 'element-plus';
import { connectWebSocket } from '../utils/websocket';
import { useAuthStore } from './auth';
import { isCapacitorApp, isNotificationSupported } from '../utils/device';

// 缓存已显示的通知 ID，避免重复通知
const shownNotificationIds = new Set<number>();

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
      const newCount = response.count;
      unreadCount.value = newCount;

      // 如果未读数量增加，获取最新通知并显示
      if (newCount > previousCount) {
        // 获取最新的未读通知
        const latestNotificationsResponse = await notificationsApi.getNotifications({
          page: 1,
          pageSize: newCount - previousCount,
          is_read: false,
        });

        // 显示新通知（从新到旧）
        const newNotifications = latestNotificationsResponse.notifications.slice(0, newCount - previousCount);
        for (const notification of newNotifications.reverse()) {
          // 检查是否已经显示过（避免重复通知）
          const alreadyShown = notifications.value.some(n => n.id === notification.id) || shownNotificationIds.has(notification.id);
          if (!alreadyShown) {
            // 添加到通知列表顶部
            notifications.value.unshift(notification);
            // 标记为已显示
            shownNotificationIds.add(notification.id);
            // 显示通知（即使在后台也会显示）
            showDesktopNotification(notification).catch((error) => {
              console.error('显示通知失败:', error);
            });
          }
        }

        // 如果当前正在查看通知列表，自动刷新
        if (lastFetchParams.value) {
          await fetchNotifications(lastFetchParams.value);
        }
      }
    } catch (error: any) {
      // 401 错误可能是 token 还未设置或已过期，静默处理
      // 其他错误才记录日志（但不显示错误消息，因为响应拦截器已经处理了）
      if (error.response?.status !== 401) {
        console.error('获取未读通知数量失败:', error);
      }
      // 401 错误时，不更新 unreadCount，保持当前值
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
   * 开始轮询未读数量
   * 注意：即使在 App 后台，轮询也会继续（但可能被系统限制）
   * 华为设备建议使用更短的轮询间隔以确保及时收到通知
   */
  const startPolling = () => {
    // 先立即获取一次
    fetchUnreadCount();
    
    // 清除之前的轮询
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value);
    }

    // 设置新的轮询（即使在后台也会继续）
    // 华为设备优化：使用 15 秒轮询间隔，确保及时收到通知
    const pollingIntervalMs = isCapacitorApp() ? 15000 : 30000; // App 环境 15 秒，Web 环境 30 秒
    pollingInterval.value = setInterval(() => {
      fetchUnreadCount();
    }, pollingIntervalMs);
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

  let notificationHandler: ((data: any) => void) | null = null;

  /**
   * 初始化实时推送
   */
  const initRealtime = () => {
    const authStore = useAuthStore();
    const currentUserId = authStore.user?.id;
    
    if (!currentUserId || notificationHandler) return; // 避免重复初始化
    
    notificationHandler = (data: any) => {
      if (data.type === 'notification-created') {
        const notification = data.notification as Notification;
        // 只处理当前用户的通知
        if (notification.user_id === currentUserId) {
          // 添加到通知列表顶部
          notifications.value.unshift(notification);
          // 更新未读数量
          unreadCount.value++;
          // 如果当前正在查看通知列表，自动刷新
          if (lastFetchParams.value) {
            fetchNotifications(lastFetchParams.value);
          }

          // 检查是否已经显示过（避免重复通知）
          if (!shownNotificationIds.has(notification.id)) {
            // 标记为已显示
            shownNotificationIds.add(notification.id);
            // 桌面通知（检查开关和权限）
            // 立即显示通知，不等待
            showDesktopNotification(notification).catch((error) => {
              console.error('显示通知失败:', error);
            });
          }
        }
      }
    };
    
    connectWebSocket(notificationHandler);
    
    // 确保 WebSocket 连接后立即检查一次未读数量（兜底机制）
    setTimeout(() => {
      fetchUnreadCount();
    }, 2000);
  };

  /**
   * 显示通知（支持桌面和移动端）
   */
  const showDesktopNotification = async (notification: Notification) => {
    const authStore = useAuthStore();
    
    // 检查通知开关
    if (!authStore.notificationEnabled) {
      return;
    }

    // Capacitor App：使用系统通知
    if (isCapacitorApp()) {
      try {
        // 使用字符串拼接避免Vite静态分析
        const modulePath = '@capacitor' + '/local-notifications';
        // 动态导入Capacitor（如果已安装）
        // @ts-ignore - Capacitor可能未安装，动态导入处理
        const capacitorModule = await import(/* @vite-ignore */ modulePath).catch(() => null);
        if (!capacitorModule) {
          console.warn('Capacitor LocalNotifications未安装，使用Web通知');
          showWebNotification(notification);
          return;
        }

        const { LocalNotifications } = capacitorModule;
        
        // 检查权限
        const permissionStatus = await LocalNotifications.checkPermissions();
        if (permissionStatus.display !== 'granted') {
          const requestResult = await LocalNotifications.requestPermissions();
          if (requestResult.display !== 'granted') {
            console.warn('用户拒绝了通知权限');
            return;
          }
        }

        // 显示本地通知（即使在后台也会显示）
        await LocalNotifications.schedule({
          notifications: [{
            title: notification.title,
            body: notification.content || '',
            id: notification.id,
            sound: 'default',
            badge: unreadCount.value || 1,
            // 添加额外数据，用于点击通知时跳转
            extra: {
              notificationId: notification.id,
              relatedType: notification.related_type,
              relatedId: notification.related_id,
            },
            // 设置优先级，确保在后台也能显示（Android 需要高优先级）
            priority: 1, // 高优先级
            // 设置通知渠道（Android 8.0+）
            channelId: 'default',
            // Android 特定设置
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#409eff',
            // 确保通知在锁屏上显示
            visibility: 1, // Public
            // 震动（如果设备支持）
            vibrate: true,
          }]
        });
      } catch (error) {
        console.error('显示Capacitor通知失败:', error);
        // 如果Capacitor失败，fallback到Web通知
        showWebNotification(notification);
      }
      return;
    }

    // Web通知（桌面和Android浏览器）
    showWebNotification(notification);
  };

  /**
   * 显示Web通知（浏览器）
   */
  const showWebNotification = (notification: Notification) => {
    // 检查浏览器支持
    if (!isNotificationSupported()) {
      return;
    }

    // 检查权限
    if (Notification.permission !== 'granted') {
      return;
    }

    // 显示通知
    try {
      const notificationInstance = new Notification(notification.title, {
        body: notification.content || '',
        icon: '/favicon.ico', // 可以替换为你的图标
        tag: `notification-${notification.id}`, // 避免重复通知
        requireInteraction: false,
      });

      // 点击通知时聚焦窗口（如果可能）
      notificationInstance.onclick = () => {
        window.focus();
        notificationInstance.close();
      };

      // 5秒后自动关闭
      setTimeout(() => {
        notificationInstance.close();
      }, 5000);
    } catch (error) {
      console.error('显示Web通知失败:', error);
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
    initRealtime,
    reset,
  };
});

