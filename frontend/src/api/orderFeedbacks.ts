import api from '../utils/request';

export interface OrderNumberFeedback {
  id: number;
  customer_id: number;
  customer_order_number: string;
  message: string | null;
  status: 'pending' | 'resolved' | 'closed';
  created_at: string;
  resolved_at: string | null;
  resolved_by: number | null;
  resolution_note: string | null;
  related_order_id: number | null;
  customer_username?: string;
  customer_company_name?: string;
  resolver_username?: string;
  related_order_number?: string;
}

interface FeedbackQueryParams {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'resolved' | 'closed';
  customer_id?: number;
  customer_order_number?: string;
  customer_company_name?: string;
  start_date?: string;
  end_date?: string;
}

export const orderFeedbacksApi = {
  // 创建订单编号反馈
  createFeedback: (data: {
    customer_order_number: string;
    message?: string;
  }): Promise<{ message: string; feedback: OrderNumberFeedback }> => {
    return api.post('/order-feedbacks', data);
  },

  // 获取反馈列表
  getFeedbacks: (params?: FeedbackQueryParams): Promise<{
    feedbacks: OrderNumberFeedback[];
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> => {
    return api.get('/order-feedbacks', { params });
  },

  // 处理反馈
  resolveFeedback: (
    id: number,
    data: {
      status?: 'pending' | 'resolved' | 'closed';
      resolution_note?: string;
      related_order_id?: number;
    }
  ): Promise<{ message: string; feedback: OrderNumberFeedback }> => {
    return api.patch(`/order-feedbacks/${id}/resolve`, data);
  },

  // 删除反馈
  deleteFeedback: (id: number): Promise<{ message: string }> => {
    return api.delete(`/order-feedbacks/${id}`);
  },
};

