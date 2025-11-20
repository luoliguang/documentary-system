import { ORDER_STATUS_OPTIONS } from '../../../constants/orderStatus.js';
import { ORDER_TYPE_OPTIONS } from '../../../constants/orderType.js';
import type { ConfigProvider } from './ConfigProvider.js';

const GENERAL_KEYS = new Set([
  'roles',
  'order_types',
  'order_statuses',
  'reminder_min_interval_hours',
  'config_permissions',
]);

const DEFAULTS: Record<string, any> = {
  roles: [
    { value: 'admin', label: '管理员' },
    { value: 'production_manager', label: '生产跟单' },
    { value: 'customer', label: '客户' },
  ],
  order_types: ORDER_TYPE_OPTIONS,
  order_statuses: ORDER_STATUS_OPTIONS,
  reminder_min_interval_hours: 2,
  config_permissions: {
    general: ['admin'],
    order_options: ['admin'],
    permissions: ['admin'],
    assignment_rules: ['admin'],
  },
};

export class GeneralConfigProvider implements ConfigProvider {
  readonly type = 'general';

  supportsKey(key: string): boolean {
    return GENERAL_KEYS.has(key);
  }

  getDefaultValue(key: string): any | undefined {
    return DEFAULTS[key];
  }

  normalize(key: string, value: any): any {
    if (key === 'reminder_min_interval_hours') {
      const numberValue = Number(value);
      return Number.isNaN(numberValue) ? DEFAULTS[key] : numberValue;
    }
    return value;
  }
}

