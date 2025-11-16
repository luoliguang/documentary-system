import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// 创建 PostgreSQL 连接池
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fangdu_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // 连接池最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时时间
  connectionTimeoutMillis: 2000, // 连接超时时间
});

// 处理连接池错误
pool.on('error', (err) => {
  console.error('数据库连接池错误:', err);
});

// 测试数据库连接
pool.query('SELECT NOW()')
  .then(() => {
    console.log('数据库连接池初始化成功');
  })
  .catch((err) => {
    console.error('数据库连接池初始化失败:', err);
  });

