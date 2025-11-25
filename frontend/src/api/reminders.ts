import api from '../utils/request';
import { DeliveryReminder } from '../types';

interface ReminderQueryParams {
  page?: number;
  pageSize?: number;
  order_id?: number;
  order_number?: string;
  customer_order_number?: string;
  company_name?: string;
  reminder_type?: 'normal' | 'urgent';
  is_resolved?: boolean;
  start_date?: string;
  end_date?: string;
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

  // 编辑催货消息（仅创建者）
  updateReminderMessage: (
    id: number,
    data: { message: string }
  ): Promise<{ message: string; reminder: DeliveryReminder }> => {
    return api.patch(`/reminders/${id}/message`, data);
  },

  // 编辑管理员回复（管理员和生产跟单）
  updateAdminResponse: (
    id: number,
    data: { admin_response: string }
  ): Promise<{ message: string; reminder: DeliveryReminder }> => {
    return api.patch(`/reminders/${id}/admin-response`, data);
  },

  // 删除催货记录
  deleteReminder: (id: number): Promise<{ message: string }> => {
    return api.delete(`/reminders/${id}`);
  },

  // 获取订单的催货统计信息（客户）
  getOrderReminderStats: (orderId: number): Promise<{
    total_count: number;
    last_reminder_time: string | null;
    next_reminder_time: string | null;
    interval_hours: number;
  }> => {
    return api.get(`/reminders/order/${orderId}/stats`);
  },

  // 生产跟单转交催货任务给其他生产跟单
  transferReminder: (
    id: number,
    data: { assigned_to: number }
  ): Promise<{ message: string; reminder: DeliveryReminder }> => {
    return api.post(`/reminders/${id}/transfer`, data);
  },

  requestTransferPermission: (
    id: number,
    data: { target_pm_id: number; order_type?: string; reason?: string }
  ): Promise<{ message: string }> => {
    return api.post(`/reminders/${id}/request-permission`, data);
  },
};

