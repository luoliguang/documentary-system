import { broadcast } from './gateway.js';

export function emitOrderUpdated(orderId: number, orderData: any) {
  broadcast({
    type: 'order-updated',
    orderId,
    order: orderData,
    timestamp: new Date().toISOString(),
  });
}

export function emitNotificationCreated(notification: any) {
  broadcast({
    type: 'notification-created',
    notification,
    timestamp: new Date().toISOString(),
  });
}

export function emitOrderActivityAdded(activity: any) {
  broadcast({
    type: 'order-activity-added',
    activity,
    timestamp: new Date().toISOString(),
  });
}

export function emitReminderUpdated(reminderId: number, reminder: any) {
  broadcast({
    type: 'reminder-updated',
    reminderId,
    reminder,
    timestamp: new Date().toISOString(),
  });
}

export function emitReminderRemoved(reminderId: number) {
  broadcast({
    type: 'reminder-removed',
    reminderId,
    timestamp: new Date().toISOString(),
  });
}

export function emitOrderDeleted(orderId: number) {
  broadcast({
    type: 'order-deleted',
    orderId,
    timestamp: new Date().toISOString(),
  });
}

