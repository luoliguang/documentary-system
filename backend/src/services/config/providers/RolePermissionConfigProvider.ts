import type { ConfigProvider } from './ConfigProvider.js';

export class RolePermissionConfigProvider implements ConfigProvider {
  readonly type = 'permissions';

  supportsKey(key: string): boolean {
    return key === 'role_permissions';
  }

  getDefaultValue(): any | undefined {
    return {};
  }

  validate(_key: string, value: any): void {
    if (!value || typeof value !== 'object') {
      throw new Error('角色权限配置必须是对象');
    }
  }
}

