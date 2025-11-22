/**
 * 设备检测工具
 */

/**
 * 检测是否是移动设备
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // 检测移动设备
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  return mobileRegex.test(userAgent.toLowerCase());
}

/**
 * 检测是否是iOS设备
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
}

/**
 * 检测是否是Android设备
 */
export function isAndroidDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  return /android/i.test(userAgent.toLowerCase());
}

/**
 * 检测是否在Capacitor环境中（已打包成App）
 */
export function isCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor;
}

/**
 * 检测浏览器是否支持Notification API
 */
export function isNotificationSupported(): boolean {
  return typeof Notification !== 'undefined';
}

/**
 * 获取通知权限状态
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

