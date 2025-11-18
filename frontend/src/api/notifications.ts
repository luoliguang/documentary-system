import api from '../utils/request';

export interface Notification {
  id: number;
  user_id: number;
  type: 'reminder' | 'assignment';
  title: string;
  content: string | null;
  related_id: number | null;
  related_type: 'order' | 'reminder' | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

interface NotificationQueryParams {
  page?: number;
  pageSize?: number;
  is_read?: boolean;
  type?: string;
}

export const notificationsApi = {
  // 获取未读通知数量
  getUnreadCount: (): Promise<{ count: number }> => {
    return api.get('/notifications/unread-count');
  },

  // 获取通知列表
  getNotifications: (
    params?: NotificationQueryParams
  ): Promise<{
    notifications: Notification[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> => {
    return api.get('/notifications', { params });
  },

  // 标记通知为已读
  markAsRead: (id: number): Promise<{ message: string; notification: Notification }> => {
    return api.patch(`/notifications/${id}/read`);
  },

  // 标记所有通知为已读
  markAllAsRead: (): Promise<{ message: string; count: number }> => {
    return api.patch('/notifications/read-all');
  },

  // 按订单标记通知为已读
  markOrderNotificationsAsRead: (
    orderId: number
  ): Promise<{ message: string; count: number }> => {
    return api.patch(`/notifications/order/${orderId}/read`);
  },

  // 删除通知
  deleteNotification: (id: number): Promise<{ message: string }> => {
    return api.delete(`/notifications/${id}`);
  },

  // 批量删除通知
  deleteNotificationsBatch: (ids: number[]): Promise<{ message: string; deleted_count: number }> => {
    // axios delete 方法需要使用 config.data 传递 body
    return api.delete('/notifications/batch', { data: { ids } });
  },
};

