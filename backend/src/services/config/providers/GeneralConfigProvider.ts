import { ORDER_STATUS_OPTIONS } from '../../../constants/orderStatus.js';
import { ORDER_TYPE_OPTIONS } from '../../../constants/orderType.js';
import { CONFIG_KEYS } from '../../../constants/configKeys.js';
import type { ConfigProvider } from './ConfigProvider.js';

const GENERAL_KEYS = new Set([
  CONFIG_KEYS.ROLES,
  CONFIG_KEYS.CUSTOMER_ROLES,
  CONFIG_KEYS.ORDER_TYPES,
  CONFIG_KEYS.ORDER_STATUSES,
  CONFIG_KEYS.REMINDER_MIN_INTERVAL_HOURS,
  CONFIG_KEYS.DEFAULT_PAGE_SIZE,
  CONFIG_KEYS.CONFIG_PERMISSIONS,
]);

const DEFAULTS: Record<string, any> = {
  [CONFIG_KEYS.ROLES]: [
    { value: 'admin', label: '管理员' },
    { value: 'production_manager', label: '生产跟单' },
    { value: 'customer', label: '客户' },
  ],
  [CONFIG_KEYS.CUSTOMER_ROLES]: ['customer'],
  [CONFIG_KEYS.ORDER_TYPES]: ORDER_TYPE_OPTIONS,
  [CONFIG_KEYS.ORDER_STATUSES]: ORDER_STATUS_OPTIONS,
  [CONFIG_KEYS.REMINDER_MIN_INTERVAL_HOURS]: 2,
  [CONFIG_KEYS.DEFAULT_PAGE_SIZE]: 20,
  [CONFIG_KEYS.CONFIG_PERMISSIONS]: {
    general: ['admin'],
    order_options: ['admin'],
    permissions: ['admin'],
    assignment_rules: ['admin'],
  },
};

export class GeneralConfigProvider implements ConfigProvider {
  readonly type = 'general';

  supportsKey(key: string): boolean {
    return GENERAL_KEYS.has(key as any);
  }

  getDefaultValue(key: string): any | undefined {
    return DEFAULTS[key as keyof typeof DEFAULTS];
  }

  normalize(key: string, value: any): any {
    if (key === CONFIG_KEYS.REMINDER_MIN_INTERVAL_HOURS) {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue) || numberValue <= 0) {
        return DEFAULTS[key];
      }
      return numberValue;
    }
    if (key === CONFIG_KEYS.DEFAULT_PAGE_SIZE) {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue) || numberValue <= 0) {
        return DEFAULTS[key];
      }
      return Math.max(1, Math.min(100, numberValue)); // 限制在 1-100 之间
    }
    return value;
  }
}

