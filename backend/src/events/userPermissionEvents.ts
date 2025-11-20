import { eventBus } from './eventBus.js';

export const USER_PERMISSION_OVERRIDE_CHANGED_EVENT = 'permission.userOverrideChanged';

export interface UserPermissionOverrideChangedPayload {
  userId: number;
  overrides: Record<string, any>;
  updatedBy?: number;
  source?: string;
  version?: string;
  timestamp: string;
}

export function publishUserPermissionOverrideChanged(
  payload: UserPermissionOverrideChangedPayload
): void {
  eventBus.emitEvent(USER_PERMISSION_OVERRIDE_CHANGED_EVENT, payload);
}

export function subscribeUserPermissionOverrideChanged(
  handler: (payload: UserPermissionOverrideChangedPayload) => void
): () => void {
  return eventBus.subscribe(USER_PERMISSION_OVERRIDE_CHANGED_EVENT, handler);
}

