import { computed, ref } from 'vue';
import { ORDER_TYPE_OPTIONS } from '../constants/orderType';
import { ORDER_STATUS_OPTIONS } from '../constants/orderStatus';
import { useConfigStore } from '../stores/config';
import { configsApi } from '../api/configs';

interface Option {
  label: string;
  value: string;
}

// 缓存选项数据，避免重复请求
const orderTypesCache = ref<Option[]>([]);
const orderStatusesCache = ref<Option[]>([]);
const rolesCache = ref<Option[]>([]);

const defaultRoles: Option[] = [
  { label: '管理员', value: 'admin' },
  { label: '客服', value: 'customer_service' },
  { label: '生产跟单', value: 'production_manager' },
  { label: '客户', value: 'customer' },
];

export const invalidateOrderTypeOptionsCache = () => {
  orderTypesCache.value = [];
};

export const invalidateOrderStatusOptionsCache = () => {
  orderStatusesCache.value = [];
};

export const invalidateRoleOptionsCache = () => {
  rolesCache.value = [];
};

export const setOrderTypeOptionsCache = (options: Option[]) => {
  orderTypesCache.value = [...options];
};

export const setOrderStatusOptionsCache = (options: Option[]) => {
  orderStatusesCache.value = [...options];
};

export const setRoleOptionsCache = (options: Option[]) => {
  rolesCache.value = [...options];
};

export function useConfigOptions() {
  const configStore = useConfigStore();
  const loading = ref(false);

  const orderTypes = computed<Option[]>(() => {
    return orderTypesCache.value.length > 0
      ? orderTypesCache.value
      : ([...ORDER_TYPE_OPTIONS] as Option[]);
  });

  const orderStatuses = computed<Option[]>(() => {
    return orderStatusesCache.value.length > 0
      ? orderStatusesCache.value
      : ([...ORDER_STATUS_OPTIONS] as Option[]);
  });

  const roles = computed<Option[]>(() => {
    // 角色选项需要管理员权限，使用 configStore
    const storeRoles = configStore.getConfigValue<Option[]>('roles', 'general');
    if (storeRoles && Array.isArray(storeRoles) && storeRoles.length > 0) {
      return storeRoles;
    }
    return rolesCache.value.length > 0 ? rolesCache.value : defaultRoles;
  });

  const loadOrderTypes = async (force = false) => {
    if (force) {
      invalidateOrderTypeOptionsCache();
    }
    if (!force && orderTypesCache.value.length > 0) {
      return; // 已缓存，不重复加载
    }
    try {
      const { data } = await configsApi.getOrderTypeOptions();
      if (data?.orderTypes) {
        orderTypesCache.value = data.orderTypes;
      } else if (force) {
        orderTypesCache.value = [];
      }
    } catch (error) {
      console.error('加载订单类型选项失败:', error);
    }
  };

  const loadOrderStatuses = async (force = false) => {
    if (force) {
      invalidateOrderStatusOptionsCache();
    }
    if (!force && orderStatusesCache.value.length > 0) {
      return; // 已缓存，不重复加载
    }
    try {
      const { data } = await configsApi.getOrderStatusOptions();
      if (data?.orderStatuses) {
        orderStatusesCache.value = data.orderStatuses;
      } else if (force) {
        orderStatusesCache.value = [];
      }
    } catch (error) {
      console.error('加载订单状态选项失败:', error);
    }
  };

  const loadRoles = async (force = false) => {
    // 角色选项需要管理员权限，继续使用 configStore
    try {
      await configStore.fetchConfig('roles', {
        type: 'general',
        force,
      });
      if (force) {
        invalidateRoleOptionsCache();
      }
    } catch (error) {
      console.error('加载角色选项失败:', error);
      if (rolesCache.value.length === 0) {
        rolesCache.value = defaultRoles;
      }
    }
  };

  const loadAllOptions = async (force = false) => {
    loading.value = true;
    try {
      await Promise.all([
        loadOrderTypes(force),
        loadOrderStatuses(force),
        loadRoles(force),
      ]);
    } finally {
      loading.value = false;
    }
  };

  const refreshAllOptions = async () => {
    await loadAllOptions(true);
  };

  const refreshRoles = async () => {
    await loadRoles(true);
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
    refreshRoles,
  };
}

