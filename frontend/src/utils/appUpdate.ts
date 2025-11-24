/**
 * App 版本检测和更新工具
 */

import { ElMessage, ElMessageBox } from 'element-plus';
import { isCapacitorApp } from './device';
import { Browser } from '@capacitor/browser';

export interface VersionInfo {
  version: string; // 版本号，如 "1.0.1"
  versionCode?: number; // 版本代码（Android）
  downloadUrl: string; // APK 下载链接
  releaseNotes?: string; // 更新说明（可选，支持 HTML）
  forceUpdate?: boolean; // 是否强制更新
  minSupportedVersion?: string; // 最低支持版本
}

const REMOTE_VERSION_BASE_URL = 'https://order.fangdutex.cn';

const isNativeCapacitorEnvironment = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  if (!isCapacitorApp()) {
    return false;
  }
  const capacitor = (window as any).Capacitor;
  if (typeof capacitor?.getPlatform === 'function') {
    const platform = capacitor.getPlatform();
    return platform && platform !== 'web';
  }
  return window.location.protocol === 'capacitor:';
};

const resolveVersionEndpoint = (preferRemote = false): string => {
  if (typeof window === 'undefined') {
    return REMOTE_VERSION_BASE_URL;
  }
  if (preferRemote) {
    return REMOTE_VERSION_BASE_URL;
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return window.location.origin;
  }
  return window.location.origin;
};

/**
 * 比较版本号
 * @param current 当前版本
 * @param latest 最新版本
 * @returns 1: 最新版本更高, 0: 相同, -1: 当前版本更高
 */
export function compareVersions(current: string, latest: string): number {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  const maxLength = Math.max(currentParts.length, latestParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) return 1;
    if (latestPart < currentPart) return -1;
  }
  
  return 0;
}

/**
 * 获取当前 App 版本号
 */
export async function getCurrentVersion(): Promise<string> {
  try {
    if (!isNativeCapacitorEnvironment()) {
      if (typeof window === 'undefined') {
        return '1.0.0';
      }
      const baseUrl = resolveVersionEndpoint(false);
      const response = await fetch(`${baseUrl}/version.json?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (response.ok) {
        const data = (await response.json()) as VersionInfo;
        return data.version || '1.0.0';
      }
    }
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return info.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

/**
 * 从服务器获取最新版本信息
 */
export async function fetchLatestVersion(): Promise<VersionInfo | null> {
  try {
    const baseUrl = resolveVersionEndpoint(isNativeCapacitorEnvironment());
    const response = await fetch(`${baseUrl}/version.json?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data as VersionInfo;
  } catch (error) {
    console.warn('获取版本信息失败:', error);
    return null;
  }
}

/**
 * 检查更新
 * @param showNoUpdateMessage 如果没有更新是否显示提示
 * @returns 是否有更新
 */
export async function checkForUpdate(showNoUpdateMessage = false): Promise<boolean> {
  try {
    const currentVersion = await getCurrentVersion();
    const latestVersionInfo = await fetchLatestVersion();
    
    if (!latestVersionInfo) {
      if (showNoUpdateMessage) {
        ElMessage.warning('无法检查更新，请稍后重试');
      }
      return false;
    }
    
    const comparison = compareVersions(currentVersion, latestVersionInfo.version);
    
    if (comparison === 1 && latestVersionInfo.downloadUrl) {
      // 有新版本
      await showUpdateDialog(latestVersionInfo, currentVersion);
      return true;
    } else {
      if (showNoUpdateMessage) {
        ElMessage.success(`当前已是最新版本 (${currentVersion})`);
      }
      return false;
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    if (showNoUpdateMessage) {
      ElMessage.error('检查更新失败，请稍后重试');
    }
    return false;
  }
}

/**
 * 显示更新对话框
 */
async function showUpdateDialog(versionInfo: VersionInfo, currentVersion: string): Promise<void> {
  const releaseNotes = versionInfo.releaseNotes || '本次更新包含性能优化和问题修复';
  
  try {
    await ElMessageBox.confirm(
      `
        <div style="text-align: left;">
          <p style="margin: 10px 0; font-size: 14px;">
            <strong>当前版本：</strong> ${currentVersion}<br/>
            <strong>最新版本：</strong> ${versionInfo.version}
          </p>
          <div style="margin: 15px 0; padding: 10px; background: #f5f7fa; border-radius: 4px;">
            <strong style="display: block; margin-bottom: 8px;">更新内容：</strong>
            <div style="font-size: 13px; line-height: 1.6; color: #606266;">
              ${releaseNotes}
            </div>
          </div>
        </div>
      `,
      '发现新版本',
      {
        dangerouslyUseHTMLString: true,
        showCancelButton: !versionInfo.forceUpdate,
        confirmButtonText: '立即下载',
        cancelButtonText: versionInfo.forceUpdate ? undefined : '稍后提醒',
        type: 'info',
        closeOnClickModal: !versionInfo.forceUpdate,
        closeOnPressEscape: !versionInfo.forceUpdate,
      }
    );
    
    // 用户点击确认，下载 APK
    await downloadUpdate(versionInfo.downloadUrl);
  } catch (error) {
    // 用户取消
    if (versionInfo.forceUpdate) {
      // 强制更新时，用户取消后再次提示
      setTimeout(() => {
        showUpdateDialog(versionInfo, currentVersion);
      }, 1000);
    }
  }
}

/**
 * 下载更新
 */
async function downloadUpdate(downloadUrl: string): Promise<void> {
  try {
    if (isCapacitorApp()) {
      // Capacitor 环境：使用 Browser 打开下载链接
      await Browser.open({ url: downloadUrl });
      ElMessage.success('正在下载，请稍候...');
    } else {
      // Web 环境：直接打开下载链接
      window.open(downloadUrl, '_blank');
      ElMessage.success('正在下载，请稍候...');
    }
  } catch (error) {
    console.error('下载更新失败:', error);
    ElMessage.error('下载失败，请手动访问下载链接');
    // 如果 Browser 打开失败，尝试直接打开
    if (isCapacitorApp()) {
      window.open(downloadUrl, '_blank');
    }
  }
}

