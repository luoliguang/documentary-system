import { configService, ConfigRecord } from './configService.js';
import { subscribeRolePermissionChanged, RolePermissionChangedPayload } from '../events/configEvents.js';

export interface RolePermissionMap {
  [role: string]: Record<string, Record<string, boolean>>;
}

interface RolePermissionState {
  permissions: RolePermissionMap;
  updatedAt: string | null;
}

type RolePermissionListener = (payload: RolePermissionState) => void;

const listeners = new Set<RolePermissionListener>();
let cache: RolePermissionState | null = null;
const TTL = 60 * 1000;
let cacheTime = 0;

function notifyListeners(state: RolePermissionState) {
  listeners.forEach((listener) => listener(state));
}

function normalizePermissions(value: any): RolePermissionMap {
  if (value && typeof value === 'object') {
    return value as RolePermissionMap;
  }
  return {};
}

async function loadRolePermissionsFromSource(): Promise<RolePermissionState> {
  const record: ConfigRecord | null = await configService.getConfigWithMeta('role_permissions');
  const permissions = normalizePermissions(record?.value);
  const state: RolePermissionState = {
    permissions,
    updatedAt: record?.updatedAt ?? null,
  };
  cache = state;
  cacheTime = Date.now();
  return state;
}

export async function getRolePermissionState(force = false): Promise<RolePermissionState> {
  if (!force && cache && Date.now() - cacheTime < TTL) {
    return cache;
  }
  return loadRolePermissionsFromSource();
}

export async function getRolePermissions(): Promise<RolePermissionMap> {
  const state = await getRolePermissionState();
  return state.permissions;
}

export function onRolePermissionsChanged(listener: RolePermissionListener): () => void {
  listeners.add(listener);
  if (cache) {
    listener(cache);
  }
  return () => {
    listeners.delete(listener);
  };
}

subscribeRolePermissionChanged((payload: RolePermissionChangedPayload) => {
  cache = {
    permissions: normalizePermissions(payload.value),
    updatedAt: payload.updatedAt ?? payload.timestamp ?? null,
  };
  cacheTime = Date.now();
  configService.invalidateCache('role_permissions');
  notifyListeners(cache);
});

