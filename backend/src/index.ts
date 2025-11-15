import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { pool } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';

const app = express();

// 中间件配置
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '跟单系统API运行正常' });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reminders', reminderRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// 启动服务器
const PORT = config.port;

app.listen(PORT, async () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📝 API 文档: http://localhost:${PORT}/health`);
  
  // 测试数据库连接
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  }
});

export default app;

