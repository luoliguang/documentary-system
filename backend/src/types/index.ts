export interface User {
  id: number;
  username: string;
  customer_code?: string;
  role: 'customer' | 'admin';
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_code?: string;
  customer_order_number?: string;
  status: 'pending' | 'in_production' | 'completed' | 'shipped' | 'cancelled';
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

