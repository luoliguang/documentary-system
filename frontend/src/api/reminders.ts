import api from '../utils/request';
import { DeliveryReminder } from '../types';

interface ReminderQueryParams {
  page?: number;
  pageSize?: number;
  order_id?: number;
  is_resolved?: boolean;
}

export const remindersApi = {
  // 创建催货记录（客户）
  createDeliveryReminder: (data: {
    order_id: number;
    reminder_type?: 'normal' | 'urgent';
    message?: string;
  }): Promise<{ message: string; reminder: DeliveryReminder }> => {
    return api.post('/reminders', data);
  },

  // 获取催货记录
  getDeliveryReminders: (params?: ReminderQueryParams): Promise<{ reminders: DeliveryReminder[] }> => {
    return api.get('/reminders', { params });
  },

  // 管理员回复催货（仅管理员）
  respondToReminder: (
    id: number,
    data: { admin_response: string; is_resolved?: boolean }
  ): Promise<{ message: string; reminder: DeliveryReminder }> => {
    return api.patch(`/reminders/${id}/respond`, data);
  },

  // 删除催货记录
  deleteReminder: (id: number): Promise<{ message: string }> => {
    return api.delete(`/reminders/${id}`);
  },
};

