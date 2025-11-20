import { eventBus } from './eventBus.js';

export const CONFIG_UPDATED_EVENT = 'config.updated';
export const CONFIG_DELETED_EVENT = 'config.deleted';
export const ROLE_PERMISSION_CHANGED_EVENT = 'config.rolePermissionsChanged';

export const ORDER_OPTION_CHANGED_EVENT = 'config.orderOptionsChanged';

export interface ConfigUpdatedPayload {
  key: string;
  type: string;
  value: any;
  description?: string | null;
  updatedBy?: number;
  source?: string;
  timestamp: string;
  updatedAt?: string;
  version?: number;
}

export interface ConfigDeletedPayload {
  key: string;
  deletedBy?: number;
  timestamp: string;
}

export interface RolePermissionChangedPayload extends ConfigUpdatedPayload {}

export interface OrderOptionChangedPayload extends ConfigUpdatedPayload {}

export function publishConfigUpdated(payload: ConfigUpdatedPayload): void {
  eventBus.emitEvent(CONFIG_UPDATED_EVENT, payload);
}

export function publishConfigDeleted(payload: ConfigDeletedPayload): void {
  eventBus.emitEvent(CONFIG_DELETED_EVENT, payload);
}

export function publishRolePermissionChanged(
  payload: RolePermissionChangedPayload
): void {
  eventBus.emitEvent(ROLE_PERMISSION_CHANGED_EVENT, payload);
}

export function publishOrderOptionChanged(
  payload: OrderOptionChangedPayload
): void {
  eventBus.emitEvent(ORDER_OPTION_CHANGED_EVENT, payload);
}

export function subscribeConfigUpdated(
  handler: (payload: ConfigUpdatedPayload) => void
): () => void {
  return eventBus.subscribe(CONFIG_UPDATED_EVENT, handler);
}

export function subscribeRolePermissionChanged(
  handler: (payload: RolePermissionChangedPayload) => void
): () => void {
  return eventBus.subscribe(ROLE_PERMISSION_CHANGED_EVENT, handler);
}

export function subscribeOrderOptionChanged(
  handler: (payload: OrderOptionChangedPayload) => void
): () => void {
  return eventBus.subscribe(ORDER_OPTION_CHANGED_EVENT, handler);
}

