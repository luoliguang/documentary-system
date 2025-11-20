export interface User {
  id: number;
  username: string;
  customer_code?: string;
  role:
    | 'customer'
    | 'admin'
    | 'production_manager'
    | 'customer_service'
    | 'follow_leader'
    | 'sales_leader';
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  assigned_order_types?: string[]; // 生产跟单的订单类型权限
  permission_overrides?: Record<string, any>; // 用户级权限覆盖
  admin_notes?: string; // 管理员备注，仅管理员可见
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

import { OrderStatus } from '../constants/orderStatus.js';
import { OrderType } from '../constants/orderType.js';

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_code?: string;
  customer_order_number?: string;
  status: OrderStatus;
  order_type?: OrderType; // 订单类型：必发、散单、拍照
  assigned_to?: number; // 分配给哪个生产跟单
  assigned_to_name?: string;
  assigned_to_ids?: number[];
  assigned_to_names?: string[];
  assigned_team?: Array<{
    id: number;
    username?: string | null;
    admin_notes?: string | null;
  }>;
  is_completed: boolean;
  can_ship: boolean;
  estimated_ship_date?: Date | string;
  actual_ship_date?: Date | string;
  notes?: string;
  internal_notes?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: number;
}

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
  created_at: Date;
  resolved_at?: Date;
}

export interface OrderStatusHistory {
  id: number;
  order_id: number;
  old_status?: string;
  new_status?: string;
  changed_by?: number;
  notes?: string;
  created_at: Date;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  customer_code?: string;
}

