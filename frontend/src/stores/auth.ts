import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { User } from '../types';
import { authApi } from '../api/auth';
import router from '../router';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  );

  const currentRole = computed<string>(() => user.value?.role ?? '');

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => currentRole.value === 'admin');
  const isCustomer = computed(() => currentRole.value === 'customer');
  const isProductionManager = computed(() => currentRole.value === 'production_manager');
  const isCustomerService = computed(() => currentRole.value === 'customer_service');

  const canManageOrders = computed(() =>
    ['admin', 'customer_service', 'follow_leader', 'sales_leader'].includes(currentRole.value)
  );
  const canManageReminders = computed(() =>
    ['admin', 'customer_service', 'follow_leader'].includes(currentRole.value)
  );
  const canManageSystem = computed(() => ['admin'].includes(currentRole.value));

  // 通知开关状态（从localStorage和user中获取，优先localStorage）
  const notificationEnabled = computed(() => {
    const localValue = localStorage.getItem('notification_enabled');
    if (localValue !== null) {
      return localValue === 'true';
    }
    return user.value?.notification_enabled ?? false;
  });

  // 登录
  const login = async (account: string, password: string) => {
    try {
      const response = await authApi.login({ account, password });
      token.value = response.token;
      user.value = response.user;

      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));

      return response;
    } catch (error) {
      throw error;
    }
  };

  // 退出登录
  const logout = () => {
    token.value = null;
    user.value = null;
    authApi.logout();
    router.push('/login');
  };

  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    try {
      const response = await authApi.getCurrentUser();
      user.value = response.user;
      localStorage.setItem('user', JSON.stringify(response.user));
      return response.user;
    } catch (error) {
      logout();
      throw error;
    }
  };

  // 更新通知开关（同时更新localStorage和user）
  const updateNotificationEnabled = (enabled: boolean) => {
    localStorage.setItem('notification_enabled', String(enabled));
    if (user.value) {
      user.value.notification_enabled = enabled;
      localStorage.setItem('user', JSON.stringify(user.value));
    }
  };

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isCustomer,
    isProductionManager,
    isCustomerService,
    canManageOrders,
    canManageReminders,
    canManageSystem,
    notificationEnabled,
    login,
    logout,
    fetchCurrentUser,
    updateNotificationEnabled,
  };
});

