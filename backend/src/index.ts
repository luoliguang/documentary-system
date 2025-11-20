import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { pool } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import userRoutes from './routes/userRoutes.js';
import configRoutes from './routes/configRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';

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

// 静态文件服务（用于访问上传的图片）
app.use('/uploads', express.static('uploads'));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/configs', configRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/follow-ups', followUpRoutes);

// 404 处理（必须在所有路由之后）
app.use(notFoundHandler);

// 错误处理中间件（必须在最后）
app.use(errorHandler);

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

