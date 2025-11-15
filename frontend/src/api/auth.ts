import api from '../utils/request';
import { LoginRequest, LoginResponse, User } from '../types';

export const authApi = {
  // 登录
  login: (data: LoginRequest): Promise<LoginResponse> => {
    return api.post('/auth/login', data);
  },

  // 获取当前用户信息
  getCurrentUser: (): Promise<{ user: User }> => {
    return api.get('/auth/me');
  },

  // 退出登录（前端处理，无需API）
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

