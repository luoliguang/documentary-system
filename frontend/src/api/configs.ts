import request from '../utils/request';

export const configsApi = {
  // 获取所有配置
  getConfigs: () => {
    return request.get('/configs');
  },

  // 获取指定配置
  getConfigByKey: (key: string) => {
    return request.get(`/configs/${key}`);
  },

  // 创建配置
  createConfig: (data: {
    config_key: string;
    config_value: any;
    description?: string;
  }) => {
    return request.post('/configs', data);
  },

  // 更新配置
  updateConfig: (key: string, data: {
    config_value: any;
    description?: string;
  }) => {
    return request.put(`/configs/${key}`, data);
  },

  // 删除配置
  deleteConfig: (key: string) => {
    return request.delete(`/configs/${key}`);
  },

  // 获取订单类型选项
  getOrderTypeOptions: () => {
    return request.get('/configs/options/order-types');
  },

  // 获取订单状态选项
  getOrderStatusOptions: () => {
    return request.get('/configs/options/order-statuses');
  },

  // 获取角色选项（仅管理员）
  getRoleOptions: () => {
    return request.get('/configs/options/roles');
  },
};

