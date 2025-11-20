import type { ConfigProvider } from './ConfigProvider.js';

const ORDER_OPTION_KEYS = new Set(['order_types', 'order_statuses']);

export class OrderOptionConfigProvider implements ConfigProvider {
  readonly type = 'order_options';

  supportsKey(key: string): boolean {
    return ORDER_OPTION_KEYS.has(key);
  }

  getDefaultValue(_key: string): any | undefined {
    return undefined;
  }

  async validate(key: string, value: any): Promise<void> {
    if (!Array.isArray(value)) {
      throw new Error(`${key} 必须是数组`);
    }
    value.forEach((item: any) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`${key} 中的每一项必须是对象`);
      }
      if (!item.value || !item.label) {
        throw new Error(`${key} 中的每一项必须包含 value 和 label`);
      }
    });
  }
}

