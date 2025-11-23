import axios, { AxiosInstance, AxiosError } from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';
import { isCapacitorApp } from './device';

// 获取 API 基础地址
const getApiBaseURL = (): string => {
  // 如果是 Capacitor 环境（已打包成 App）
  if (isCapacitorApp()) {
    // Capacitor 会将 window.location 重写为 server.url 的值
    // 所以可以直接使用 window.location.origin
    const origin = window.location.origin;
    // 如果 origin 是 capacitor://localhost（默认值），使用生产环境地址
    if (origin.includes('capacitor://') || origin.includes('localhost')) {
      return 'https://order.fangdutex.cn/api';
    }
    return `${origin}/api`;
  }
  
  // Web 环境：开发时使用代理，生产时使用完整地址
  if (import.meta.env.DEV) {
    // 开发环境使用相对路径（Vite 代理会处理）
    return '/api';
  }
  
  // 生产环境 Web：使用完整地址
  return import.meta.env.VITE_API_BASE_URL || 'https://order.fangdutex.cn/api';
};

const api: AxiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error: AxiosError<{ error?: string; message?: string }>) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          ElMessage.error('未授权，请重新登录');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          break;
        case 403:
          // 检查是否是账号被禁用的错误
          const errorMessage = data?.error || data?.message || '';
          if (errorMessage.includes('账号已被禁用') || errorMessage.includes('禁用')) {
            ElMessage.error('账号已被禁用，请联系管理员');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            router.push('/login');
          } else {
            ElMessage.error(errorMessage || '权限不足');
          }
          break;
        case 404:
          ElMessage.error('请求的资源不存在');
          break;
        case 500:
          ElMessage.error('服务器内部错误');
          break;
        case 400:
          // 400错误通常是业务逻辑错误（如订单编号已存在），由组件自己处理，不在这里显示
          // 避免重复显示错误消息
          break;
        default:
          ElMessage.error(data?.error || data?.message || '请求失败');
      }
    } else if (error.request) {
      ElMessage.error('网络错误，请检查网络连接');
    } else {
      ElMessage.error('请求配置错误');
    }

    return Promise.reject(error);
  }
);

export default api;

