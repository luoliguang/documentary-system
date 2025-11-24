import OSS from 'ali-oss';
import { config } from '../config/env.js';
import path from 'path';

// OSS客户端实例
let ossClient: OSS | null = null;

/**
 * 清理region格式，确保格式正确
 * @param region 原始region值
 * @returns 清理后的region
 */
function normalizeRegion(region: string): string {
  if (!region) return region;
  // 移除 .aliyuncs.com 后缀（如果存在）
  return region.replace(/\.aliyuncs\.com$/, '');
}

/**
 * 初始化OSS客户端
 */
function getOSSClient(): OSS {
  if (!ossClient) {
    if (!config.oss.region || !config.oss.accessKeyId || !config.oss.accessKeySecret || !config.oss.bucket) {
      throw new Error('OSS配置不完整，请检查环境变量：OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET');
    }

    const normalizedRegion = normalizeRegion(config.oss.region);

    try {
      ossClient = new OSS({
        region: normalizedRegion,
        accessKeyId: config.oss.accessKeyId,
        accessKeySecret: config.oss.accessKeySecret,
        bucket: config.oss.bucket,
        // 如果使用自定义域名
        ...(config.oss.endpoint && { endpoint: config.oss.endpoint }),
        // 是否使用HTTPS
        secure: config.oss.secure !== false,
      });
    } catch (error: any) {
      console.error('OSS客户端初始化失败:', error);
      throw new Error(`OSS客户端初始化失败: ${error.message || '未知错误'}`);
    }
  }
  return ossClient;
}

/**
 * 生成唯一的文件名
 * @param originalName 原始文件名
 * @returns 唯一文件名
 */
function generateUniqueFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1E9);
  return `images/${timestamp}-${random}${ext}`;
}

/**
 * 上传文件到OSS
 * @param fileBuffer 文件Buffer
 * @param originalName 原始文件名
 * @param mimeType MIME类型
 * @returns OSS上传结果，包含URL
 */
export async function uploadToOSS(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ url: string; key: string }> {
  try {
    const client = getOSSClient();
    const objectName = generateUniqueFileName(originalName);

    const result = await client.put(objectName, fileBuffer, {
      mime: mimeType,
      // 设置访问权限：private（私有，需要签名URL）或 public-read（公共读）
      // 根据安全需求选择，这里使用private更安全
      headers: {
        'x-oss-object-acl': config.oss.acl || 'private',
      },
    });

    // 如果Bucket是私有的，返回的URL需要签名才能访问
    // 这里返回object key，实际访问时通过签名URL接口获取
    const url = config.oss.usePublicUrl 
      ? result.url 
      : `${config.oss.bucketUrl || ''}/${objectName}`;

    return {
      url,
      key: objectName,
    };
  } catch (error: any) {
    console.error('OSS上传失败:', error);
    // 提供更详细的错误信息
    let errorMessage = '文件上传失败';
    if (error.code) {
      errorMessage += ` [${error.code}]`;
    }
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    // 常见错误提示
    if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      errorMessage += ' (请检查AccessKey配置是否正确)';
    } else if (error.code === 'NoSuchBucket') {
      errorMessage += ' (请检查Bucket名称是否正确)';
    } else if (error.code === 'InvalidRegion') {
      errorMessage += ' (请检查Region配置是否正确，格式应为: oss-cn-xxx)';
    }
    throw new Error(errorMessage);
  }
}

/**
 * 生成签名URL（用于访问私有文件）
 * @param objectName OSS对象名称（key）
 * @param expires 过期时间（秒），默认1小时
 * @returns 签名URL
 */
export async function getSignedUrl(objectName: string, expires: number = 3600 * 24 * 7): Promise<string> {
  try {
    const client = getOSSClient();
    const url = client.signatureUrl(objectName, {
      expires,
      method: 'GET',
    });
    return url;
  } catch (error: any) {
    console.error('生成签名URL失败:', error);
    throw new Error(`生成签名URL失败: ${error.message || '未知错误'}`);
  }
}

/**
 * 从URL中提取OSS对象key
 * @param url 图片URL
 * @returns OSS对象key，如果不是OSS URL则返回null
 */
export function extractOSSKey(url: string): string | null {
  if (!url) return null;
  
  try {
    // 尝试解析URL（包括签名URL）
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // 从pathname中提取key（移除开头的斜杠）
    let key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    
    // 如果key以images/开头，说明是OSS文件
    if (key.startsWith('images/')) {
      return key;
    }
    
    // 如果URL包含bucket名称，也认为是OSS URL
    if (url.includes(config.oss.bucket) || (config.oss.endpoint && url.includes(config.oss.endpoint))) {
      return key || null;
    }
  } catch {
    // 如果不是有效URL，尝试正则匹配
    const match = url.match(/images\/[\w\-\.]+/);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * 删除OSS文件
 * @param objectName OSS对象名称（key）
 */
export async function deleteFromOSS(objectName: string): Promise<void> {
  try {
    const client = getOSSClient();
    await client.delete(objectName);
  } catch (error: any) {
    console.error('OSS删除失败:', error);
    throw new Error(`文件删除失败: ${error.message || '未知错误'}`);
  }
}

/**
 * 批量删除OSS文件
 * @param objectNames OSS对象名称数组（keys）
 * @returns 删除结果，包含成功和失败的列表
 */
export async function deleteMultipleFromOSS(objectNames: string[]): Promise<{
  success: string[];
  failed: Array<{ key: string; error: string }>;
}> {
  const result = {
    success: [] as string[],
    failed: [] as Array<{ key: string; error: string }>,
  };

  if (!objectNames || objectNames.length === 0) {
    return result;
  }

  // 并发删除，但限制并发数
  const deletePromises = objectNames.map(async (key) => {
    try {
      await deleteFromOSS(key);
      result.success.push(key);
    } catch (error: any) {
      result.failed.push({
        key,
        error: error.message || '未知错误',
      });
    }
  });

  await Promise.all(deletePromises);
  return result;
}

/**
 * 从图片URL数组中提取OSS keys并删除
 * @param imageUrls 图片URL数组
 * @returns 删除结果
 */
export async function deleteImagesFromOSS(imageUrls: string[]): Promise<{
  success: string[];
  failed: Array<{ url: string; error: string }>;
}> {
  const result = {
    success: [] as string[],
    failed: [] as Array<{ url: string; error: string }>,
  };

  if (!imageUrls || imageUrls.length === 0) {
    return result;
  }

  // 提取所有OSS keys
  const ossKeys: string[] = [];
  for (const url of imageUrls) {
    const key = extractOSSKey(url);
    if (key) {
      ossKeys.push(key);
    } else {
      // 如果不是OSS URL（可能是本地uploads），记录但不删除
      console.log(`跳过非OSS URL: ${url}`);
    }
  }

  if (ossKeys.length === 0) {
    return result;
  }

  // 批量删除
  const deleteResult = await deleteMultipleFromOSS(ossKeys);
  
  // 映射回URL
  for (const key of deleteResult.success) {
    const url = imageUrls.find(u => extractOSSKey(u) === key);
    if (url) {
      result.success.push(url);
    }
  }

  for (const { key, error } of deleteResult.failed) {
    const url = imageUrls.find(u => extractOSSKey(u) === key);
    if (url) {
      result.failed.push({ url, error });
    }
  }

  return result;
}

/**
 * 检查文件是否存在
 * @param objectName OSS对象名称（key）
 * @returns 是否存在
 */
export async function checkFileExists(objectName: string): Promise<boolean> {
  try {
    const client = getOSSClient();
    await client.head(objectName);
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
}

