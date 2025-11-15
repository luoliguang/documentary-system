// 用户类型
export interface User {
  id: number;
  username: string;
  customer_code?: string;
  role: 'customer' | 'admin';
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// 订单类型
export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_code?: string;
  customer_order_number?: string;
  status: 'pending' | 'in_production' | 'completed' | 'shipped' | 'cancelled';
  is_completed: boolean;
  can_ship: boolean;
  estimated_ship_date?: string;
  actual_ship_date?: string;
  notes?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: number;
  // 关联数据
  company_name?: string;
  contact_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

// 催货记录类型
export interface DeliveryReminder {
  id: number;
  order_id: number;
  customer_id: number;
  reminder_type: 'normal' | 'urgent';
  message?: string;
  admin_response?: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
  // 关联数据
  order_number?: string;
  company_name?: string;
  contact_name?: string;
}

// 订单状态历史类型
export interface OrderStatusHistory {
  id: number;
  order_id: number;
  old_status?: string;
  new_status?: string;
  changed_by?: number;
  notes?: string;
  created_at: string;
  changed_by_username?: string;
}

// API 响应类型
export interface ApiResponse<T> {
  message?: string;
  error?: string;
  data?: T;
}

export interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: Pagination;
}

// 登录请求类型
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

