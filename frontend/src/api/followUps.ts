import api from '../utils/request';

export interface FollowUp {
  id: number;
  order_id: number;
  production_manager_id: number;
  content: string;
  is_visible_to_customer: boolean;
  created_at: string;
  updated_at: string;
  production_manager_name?: string;
  order_number?: string;
}

export interface FollowUpSummary {
  order_id: number;
  order_number: string;
  customer_order_number?: string;
  company_name?: string;
  contact_name?: string;
  status: string;
  last_follow_up_at: string | null;
  follow_up_count: number;
  has_customer_visible: boolean;
  images?: string[];
  has_document?: boolean;
  image_count?: number;
}

export interface FollowUpSummaryQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
  hasFollowUp?: 'true' | 'false';
  hasCustomerVisible?: 'true' | 'false';
  hasDocument?: 'true' | 'false';
}

export const followUpsApi = {
  // 创建跟进记录
  createFollowUp: (data: {
    order_id: number;
    content: string;
    is_visible_to_customer?: boolean;
  }): Promise<{ message: string; followUp: FollowUp }> => {
    return api.post('/follow-ups', data);
  },

  // 获取订单的跟进记录列表
  getOrderFollowUps: (orderId: number): Promise<{ followUps: FollowUp[] }> => {
    return api.get(`/follow-ups/order/${orderId}`);
  },

  // 获取跟进记录详情
  getFollowUp: (id: number): Promise<{ followUp: FollowUp }> => {
    return api.get(`/follow-ups/${id}`);
  },

  // 更新跟进记录
  updateFollowUp: (
    id: number,
    data: {
      content?: string;
      is_visible_to_customer?: boolean;
    }
  ): Promise<{ message: string; followUp: FollowUp }> => {
    return api.put(`/follow-ups/${id}`, data);
  },

  // 删除跟进记录
  deleteFollowUp: (id: number): Promise<{ message: string }> => {
    return api.delete(`/follow-ups/${id}`);
  },

  // 获取生产跟单自己的跟进概览
  getMyFollowUpSummary: (
    params?: FollowUpSummaryQuery
  ): Promise<{
    summaries: FollowUpSummary[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> => {
    return api.get('/follow-ups/my', { params });
  },
};

