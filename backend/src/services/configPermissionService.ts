import { configService } from './configService.js';

export type ConfigScope =
  | 'general'
  | 'order_options'
  | 'permissions'
  | 'assignment_rules';

const DEFAULT_CONFIG_PERMISSIONS: Record<ConfigScope, string[]> = {
  general: ['admin'],
  order_options: ['admin'],
  permissions: ['admin'],
  assignment_rules: ['admin'],
};

export async function canManageConfigScope(
  role: string,
  scope: ConfigScope
): Promise<boolean> {
  if (role === 'admin') {
    return true;
  }

  const config = (await configService.getConfig('config_permissions', {
    type: 'general',
  })) as Record<string, string[]> | null;
  const allowedRoles =
    config?.[scope] ?? DEFAULT_CONFIG_PERMISSIONS[scope] ?? [];
  return allowedRoles.includes(role);
}

