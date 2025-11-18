import { ref } from 'vue';
import { configsApi } from '../api/configs';

interface Option {
  label: string;
  value: string;
}

/**
 * 配置选项 Composable
 * 提供订单类型、订单状态、角色等选项的获取和缓存
 */
export function useConfigOptions() {
  const orderTypes = ref<Option[]>([]);
  const orderStatuses = ref<Option[]>([]);
  const roles = ref<Option[]>([]);
  const loading = ref(false);

  // 默认选项（作为后备）
  const defaultOrderTypes: Option[] = [
    { label: '必发', value: 'required' },
    { label: '散单', value: 'scattered' },
    { label: '拍照', value: 'photo' },
  ];

  const defaultOrderStatuses: Option[] = [
    { label: '待处理', value: 'pending' },
    { label: '已分配', value: 'assigned' },
    { label: '生产中', value: 'in_production' },
    { label: '已完成', value: 'completed' },
    { label: '已发货', value: 'shipped' },
    { label: '已取消', value: 'cancelled' },
  ];

  const defaultRoles: Option[] = [
    { label: '管理员', value: 'admin' },
    { label: '生产跟单', value: 'production_manager' },
    { label: '客户', value: 'customer' },
  ];

  /**
   * 加载订单类型选项
   */
  const loadOrderTypes = async () => {
    if (orderTypes.value.length > 0) return; // 已加载，不重复加载
    
    try {
      const { data } = await configsApi.getOrderTypeOptions();
      orderTypes.value = data?.orderTypes || defaultOrderTypes;
    } catch (error) {
      console.error('加载订单类型选项失败:', error);
      orderTypes.value = defaultOrderTypes;
    }
  };

  /**
   * 加载订单状态选项
   */
  const loadOrderStatuses = async () => {
    if (orderStatuses.value.length > 0) return; // 已加载，不重复加载
    
    try {
      const { data } = await configsApi.getOrderStatusOptions();
      orderStatuses.value = data?.orderStatuses || defaultOrderStatuses;
    } catch (error) {
      console.error('加载订单状态选项失败:', error);
      orderStatuses.value = defaultOrderStatuses;
    }
  };

  /**
   * 加载角色选项
   */
  const loadRoles = async () => {
    if (roles.value.length > 0) return; // 已加载，不重复加载
    
    try {
      const { data } = await configsApi.getRoleOptions();
      roles.value = data?.roles || defaultRoles;
    } catch (error) {
      console.error('加载角色选项失败:', error);
      roles.value = defaultRoles;
    }
  };

  /**
   * 加载所有选项
   */
  const loadAllOptions = async () => {
    loading.value = true;
    try {
      await Promise.all([
        loadOrderTypes(),
        loadOrderStatuses(),
        loadRoles(),
      ]);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 刷新所有选项（强制重新加载）
   */
  const refreshAllOptions = async () => {
    orderTypes.value = [];
    orderStatuses.value = [];
    roles.value = [];
    await loadAllOptions();
  };

  return {
    orderTypes,
    orderStatuses,
    roles,
    loading,
    loadOrderTypes,
    loadOrderStatuses,
    loadRoles,
    loadAllOptions,
    refreshAllOptions,
  };
}

