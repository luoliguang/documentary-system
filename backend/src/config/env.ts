import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3006'),
  wsPort: parseInt(process.env.WS_PORT || '3007'), // WebSocket端口
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5176',
  // OSS配置
  oss: {
    region: process.env.OSS_REGION || 'oss-cn-guangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || 'fangdu-order-image',
    endpoint: process.env.OSS_ENDPOINT || '', // 可选：自定义域名
    bucketUrl: process.env.OSS_BUCKET_URL || '', // 可选：Bucket的公共URL前缀
    secure: process.env.OSS_SECURE !== 'false', // 是否使用HTTPS，默认true
    acl: process.env.OSS_ACL || 'private', // 访问权限：private 或 public-read
    usePublicUrl: process.env.OSS_USE_PUBLIC_URL === 'true', // 是否直接使用公共URL
  },
};

