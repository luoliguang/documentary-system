import axios, { AxiosInstance, AxiosError } from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
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

