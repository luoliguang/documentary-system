import axios from 'axios';

/**
 * 获取API基础URL
 */
function getApiBaseURL(): string {
  // 检测是否在Capacitor环境中
  const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor;
  
  if (isCapacitor) {
    // Capacitor 会将 window.location 重写为 server.url 的值
    const origin = window.location.origin;
    // 如果 origin 是 capacitor://localhost（默认值），使用生产环境地址
    if (origin.includes('capacitor://') || origin.includes('localhost')) {
      return 'https://order.fangdutex.cn/api';
    }
    return `${origin}/api`;
  }
  
  // Web 环境
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 开发环境使用本地地址
  if (import.meta.env.DEV) {
    return 'http://localhost:3006/api';
  }
  
  // 生产环境Web
  return 'https://order.fangdutex.cn/api';
}

const API_BASE_URL = getApiBaseURL();

// 获取token的辅助函数
function getToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * 检查URL是否是OSS URL（需要签名）
 * @param url 图片URL
 * @returns 是否是OSS URL
 */
export function isOSSUrl(url: string): boolean {
  if (!url) return false;
  // 检查是否包含OSS域名特征或自定义域名
  return url.includes('aliyuncs.com') || 
         url.includes('oss-') || 
         url.includes('/images/');
}

/**
 * 检查URL是否是本地uploads路径（旧图片）
 * @param url 图片URL
 * @returns 是否是本地路径
 */
export function isLocalUploadUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('/uploads/') && !url.includes('aliyuncs.com');
}

/**
 * 获取签名URL（如果URL过期需要刷新）
 * @param url 原始图片URL
 * @param expires 过期时间（秒），默认1小时
 * @returns 签名URL
 */
export async function getSignedImageUrl(url: string, expires: number = 3600): Promise<string> {
  if (!url) return url;
  
  // 如果是本地uploads路径，直接返回
  if (isLocalUploadUrl(url)) {
    return url;
  }

  // 如果是OSS URL，尝试获取签名URL
  if (isOSSUrl(url)) {
    try {
      const token = getToken();
      const response = await axios.post(
        `${API_BASE_URL}/api/upload/signed-url`,
        { url, expires },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data.url || url;
    } catch (error) {
      console.warn('获取签名URL失败，使用原始URL:', error);
      return url;
    }
  }

  // 其他情况直接返回
  return url;
}

/**
 * 处理图片URL，如果是OSS URL且可能过期，尝试刷新
 * 注意：这个方法会异步获取签名URL，适合在需要时调用
 * 对于已经有效的签名URL，可以直接使用，不需要调用此方法
 * 
 * @param url 图片URL
 * @returns 处理后的URL（可能是Promise）
 */
export function processImageUrl(url: string): string | Promise<string> {
  if (!url) return url;
  
  // 本地路径直接返回
  if (isLocalUploadUrl(url)) {
    return url;
  }

  // 如果URL看起来是签名URL（包含签名参数），直接返回
  if (url.includes('Expires=') && url.includes('Signature=')) {
    return url;
  }

  // 如果是OSS URL但没有签名，尝试获取签名URL
  if (isOSSUrl(url)) {
    return getSignedImageUrl(url);
  }

  return url;
}

