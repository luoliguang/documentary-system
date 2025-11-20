import request from '../utils/request';

export interface ConfigMeta {
  key: string;
  type: string;
  version?: number;
  updatedAt?: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
}

export const configsApi = {
  getConfigs: (params?: { type?: string }) => {
    return request.get('/configs', { params });
  },

  getConfigByKey: (key: string, params?: { type?: string }) => {
    return request.get(`/configs/${key}`, { params });
  },

  createConfig: (data: {
    config_key: string;
    config_value: any;
    description?: string;
    type?: string;
    metadata?: Record<string, any>;
  }) => {
    return request.post('/configs', data);
  },

  updateConfig: (
    key: string,
    data: {
      config_value: any;
      description?: string;
      type?: string;
      metadata?: Record<string, any>;
    }
  ) => {
    return request.put(`/configs/${key}`, data);
  },

  deleteConfig: (key: string, params?: { type?: string }) => {
    return request.delete(`/configs/${key}`, { params });
  },

  getOrderTypeOptions: () => {
    return request.get('/configs/options/order-types');
  },

  getOrderStatusOptions: () => {
    return request.get('/configs/options/order-statuses');
  },

  getRoleOptions: () => {
    return request.get('/configs/options/roles');
  },
};

