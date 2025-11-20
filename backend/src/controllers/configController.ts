import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { configService } from '../services/configService.js';
import {
  getOrderTypeOptions as getOrderTypeOptionsHelper,
  getOrderStatusOptions as getOrderStatusOptionsHelper,
  getRoleOptions as getRoleOptionsHelper,
} from '../utils/configHelpers.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { ErrorFactory } from '../errors/AppError.js';
import { canManageConfigScope } from '../services/configPermissionService.js';
import type { ConfigScope } from '../services/configPermissionService.js';
import type { ConfigRecord } from '../services/configService.js';

const KEY_SCOPE_MAP: Record<string, ConfigScope> = {
  role_permissions: 'permissions',
  order_types: 'order_options',
  order_statuses: 'order_options',
  assignment_rules: 'assignment_rules',
};

const TYPE_SCOPE_MAP: Record<string, ConfigScope> = {
  general: 'general',
  permissions: 'permissions',
  order_options: 'order_options',
  assignment_rules: 'assignment_rules',
};

function resolveScope(key?: string): ConfigScope {
  if (!key) return 'general';
  return KEY_SCOPE_MAP[key] ?? 'general';
}

function resolveScopeByType(type?: string): ConfigScope | undefined {
  if (!type) return undefined;
  return TYPE_SCOPE_MAP[type] ?? undefined;
}

function mapRecord(record: ConfigRecord) {
  return {
    key: record.key,
    value: record.value,
    description: record.description,
    updatedAt: record.updatedAt,
    type: record.type,
    version: record.version,
    metadata: record.metadata,
  };
}

async function assertScopePermission(
  req: AuthRequest,
  key?: string,
  scopeOverride?: ConfigScope
) {
  const scope = scopeOverride ?? resolveScope(key);
  const user = req.user;
  if (!user) {
    throw ErrorFactory.unauthorized('未登录');
  }
  const allowed = await canManageConfigScope(user.role, scope);
  if (!allowed) {
    throw ErrorFactory.forbidden('您没有权限执行该配置操作');
  }
  return scope;
}

// 获取所有配置（仅管理员）
export const getConfigs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const typeParam =
    typeof req.query.type === 'string' ? req.query.type : undefined;
  await assertScopePermission(req, undefined, resolveScopeByType(typeParam));
  const configs = typeParam
    ? await configService.getConfigsByType(typeParam)
    : await configService.getAllConfigs();
  res.json({ configs: configs.map(mapRecord) });
});

// 获取指定配置
export const getConfigByKey = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const typeParam =
    typeof req.query.type === 'string' ? req.query.type : undefined;
  await assertScopePermission(
    req,
    key,
    resolveScopeByType(typeParam)
  );
  const record = await configService.getConfigWithMeta(key, {
    type: typeParam,
  });

  if (!record) {
    throw ErrorFactory.notFound('配置不存在');
  }

  res.json({
    config: record.value,
    meta: mapRecord(record),
  });
});

// 创建配置
export const createConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { config_key, config_value, description, type, metadata } = req.body;

  if (!config_key || config_value === undefined) {
    throw ErrorFactory.badRequest('配置键和配置值不能为空');
  }

  await assertScopePermission(
    req,
    config_key,
    resolveScopeByType(type)
  );
  await configService.setConfig(config_key, config_value, description, {
    updatedBy: req.user?.userId,
    source: 'api:createConfig',
    type,
    metadata,
  });
  const config = await configService.getConfigWithMeta(config_key, { type });
  res.status(201).json({
    message: '配置创建成功',
    config: config?.value ?? null,
    meta: config ? mapRecord(config) : null,
  });
});

// 更新配置
export const updateConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const { config_value, description, type, metadata } = req.body;

  if (config_value === undefined) {
    throw ErrorFactory.badRequest('配置值不能为空');
  }

  await assertScopePermission(
    req,
    key,
    resolveScopeByType(type)
  );
  await configService.setConfig(key, config_value, description, {
    updatedBy: req.user?.userId,
    source: 'api:updateConfig',
    type,
    metadata,
  });
  const config = await configService.getConfigWithMeta(key, { type });
  res.json({
    message: '配置更新成功',
    config: config?.value ?? null,
    meta: config ? mapRecord(config) : null,
  });
});

// 删除配置
export const deleteConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { key } = req.params;
  const typeParam =
    typeof req.query.type === 'string' ? req.query.type : undefined;

  // 不允许删除系统核心配置
  const coreConfigs = ['roles', 'order_types', 'order_statuses', 'role_permissions'];
  if (coreConfigs.includes(key)) {
    throw ErrorFactory.badRequest('不能删除系统核心配置');
  }

  await assertScopePermission(
    req,
    key,
    resolveScopeByType(typeParam)
  );
  await configService.deleteConfig(key, {
    updatedBy: req.user?.userId,
    source: 'api:deleteConfig',
    type: typeParam,
  });
  res.json({ message: '配置删除成功' });
});

// 获取订单类型选项（公开接口，不需要管理员权限）
export const getOrderTypeOptions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const options = await getOrderTypeOptionsHelper();
  res.json({ orderTypes: options });
});

// 获取订单状态选项（公开接口，不需要管理员权限）
export const getOrderStatusOptions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const options = await getOrderStatusOptionsHelper();
  res.json({ orderStatuses: options });
});

// 获取角色选项（仅管理员）
export const getRoleOptions = asyncHandler(async (req: AuthRequest, res: Response) => {
  await assertScopePermission(req);
  const options = await getRoleOptionsHelper();
  res.json({ roles: options });
});

export const getRolePermissionsConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  await assertScopePermission(req, 'role_permissions', 'permissions');
  const record = await configService.getConfigWithMeta('role_permissions', {
    type: 'permissions',
  });
  if (!record) {
    throw ErrorFactory.notFound('角色权限配置不存在');
  }
  res.json({
    rolePermissions: record.value,
    updatedAt: record.updatedAt,
    description: record.description,
    version: record.version,
  });
});

