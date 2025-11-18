// 用户类型
export interface User {
  id: number;
  account?: string; // 登录账号，仅允许字母、数字、下划线
  username: string; // 用户名/显示名称，可以包含中文
  customer_code?: string;
  role: 'customer' | 'admin' | 'production_manager';
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  assigned_order_types?: string[]; // 生产跟单的订单类型权限
  admin_notes?: string; // 管理员备注，仅管理员可见
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// 发货单号类型
export interface ShippingTrackingNumber {
  type: 'main' | 'supplement' | 'split_address' | 'other'; // 主单号、补件单号、分地址单号、其他
  number: string; // 单号
  label?: string; // 自定义标签（如"主单号"、"补件单号"等）
}

// 订单类型
export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_code?: string;
  customer_order_number?: string;
  status: 'pending' | 'assigned' | 'in_production' | 'completed' | 'shipped' | 'cancelled';
  order_type?: 'required' | 'scattered' | 'photo'; // 订单类型：必发、散单、拍照
  assigned_to?: number; // 分配给哪个生产跟单
  assigned_to_name?: string; // 生产跟单名称
  is_completed: boolean;
  can_ship: boolean;
  order_date?: string; // 下单时间
  estimated_ship_date?: string;
  actual_ship_date?: string;
  notes?: string;
  internal_notes?: string;
  images?: string[]; // 订单图片URL数组
  shipping_tracking_numbers?: ShippingTrackingNumber[]; // 发货单号数组
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
  is_admin_assigned?: boolean; // 是否为管理员派送的催货任务
  assigned_to?: number; // 分配给哪个生产跟单
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
  // 关联数据
  order_number?: string;
  customer_order_number?: string;
  company_name?: string;
  contact_name?: string;
  images?: string[]; // 订单图片URL数组
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
  account: string; // 登录账号
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

// 通知类型
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

