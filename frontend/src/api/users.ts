import api from '../utils/request';
import { User, Pagination } from '../types';

interface UsersQueryParams {
  page?: number;
  pageSize?: number;
  role?: string;
  is_active?: boolean;
  search?: string;
}

interface UsersResponse {
  users: User[];
  pagination: Pagination;
}

export const usersApi = {
  // 获取用户列表（仅管理员）
  getUsers: (params?: UsersQueryParams): Promise<UsersResponse> => {
    return api.get('/users', { params });
  },

  // 获取用户详情（仅管理员）
  getUserById: (id: number): Promise<{ user: User }> => {
    return api.get(`/users/${id}`);
  },

  // 创建用户（仅管理员）
  createUser: (data: Partial<User> & { password: string }): Promise<{ message: string; user: User }> => {
    return api.post('/users', data);
  },

  // 更新用户信息（仅管理员）
  updateUser: (id: number, data: Partial<User>): Promise<{ message: string; user: User }> => {
    return api.put(`/users/${id}`, data);
  },

  // 删除用户（仅管理员，软删除）
  deleteUser: (id: number): Promise<{ message: string }> => {
    return api.delete(`/users/${id}`);
  },

  // 重置用户密码（仅管理员）
  resetUserPassword: (id: number, new_password: string): Promise<{ message: string }> => {
    return api.put(`/users/${id}/password`, { new_password });
  },

  // 启用/禁用用户（仅管理员）
  toggleUserStatus: (id: number, is_active: boolean): Promise<{ message: string }> => {
    return api.put(`/users/${id}/status`, { is_active });
  },
};

// 用户个人中心API
export const profileApi = {
  // 更新个人信息
  updateProfile: (data: { contact_name?: string; email?: string; phone?: string; notification_enabled?: boolean }): Promise<{ message: string; user: User }> => {
    return api.put('/auth/profile', data);
  },

  // 修改密码
  updatePassword: (data: { old_password: string; new_password: string }): Promise<{ message: string }> => {
    return api.put('/auth/profile/password', data);
  },
};

