import { createApp } from './app.js';
import { config } from './config/env.js';
import { pool } from './config/database.js';
import { initWebSocket } from './websocket/gateway.js';

const app = createApp();

// 启动服务器
const PORT = config.port;

app.listen(PORT, async () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📝 API 文档: http://localhost:${PORT}/health`);
  
  // 初始化WebSocket服务器（从环境变量读取端口）
  initWebSocket(config.wsPort);
  
  // 测试数据库连接
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  }
});

export default app;

