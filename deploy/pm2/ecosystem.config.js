// ============================================
// PM2 配置文件
// 使用方法: pm2 start ecosystem.config.js
// ============================================

module.exports = {
  apps: [
    {
      name: 'fangdu-backend',
      script: './backend/dist/index.js',
      cwd: '/var/www/fangdu-system',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
      },
      error_file: '/var/log/fangdu/backend-error.log',
      out_file: '/var/log/fangdu/backend.log',
      log_file: '/var/log/fangdu/backend-combined.log',
      time: true,
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      exp_backoff_restart_delay: 100,
    },
  ],
};

