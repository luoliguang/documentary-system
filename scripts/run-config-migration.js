const fs = require('fs');
const path = require('path');

// 添加 backend 的 node_modules 到模块搜索路径
const backendNodeModules = path.resolve(__dirname, '../backend/node_modules');
// 修改 module.paths（在 require 之前）
const originalPaths = module.paths.slice();
module.paths = [backendNodeModules, ...originalPaths];

// 加载 dotenv（从 backend 目录）
const dotenvPath = path.join(__dirname, '../backend/.env');
if (fs.existsSync(dotenvPath)) {
  // 先加载 dotenv 模块
  const dotenvModule = path.join(backendNodeModules, 'dotenv');
  if (fs.existsSync(dotenvModule)) {
    require(dotenvModule).config({ path: dotenvPath });
  } else {
    require('dotenv').config({ path: dotenvPath });
  }
} else {
  // 尝试从项目根目录加载
  const rootDotenv = path.join(__dirname, '../.env');
  if (fs.existsSync(rootDotenv)) {
    require('dotenv').config({ path: rootDotenv });
  } else {
    require('dotenv').config();
  }
}

// 现在可以安全地 require pg
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fangdu_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('📦 开始执行系统配置数据库迁移...');
    console.log(`📊 数据库: ${pool.options.database}`);
    console.log(`👤 用户: ${pool.options.user}`);
    console.log(`🌐 主机: ${pool.options.host}:${pool.options.port}`);
    console.log('');
    
    // 读取迁移脚本
    const migrationPath = path.join(__dirname, '../database/migrations/002_add_system_configs.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`迁移脚本不存在: ${migrationPath}`);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // 执行迁移
    console.log('🔄 开始事务...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ 事务已提交');
    
    // 验证迁移结果
    console.log('');
    console.log('🔍 验证迁移结果...');
    
    const verifyQuery = `
      SELECT 
        CASE WHEN EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'system_configs'
        ) THEN '✅ system_configs 表已创建' 
        ELSE '❌ system_configs 表未创建' END as table_status,
        (SELECT COUNT(*) FROM system_configs) as config_count;
    `;
    
    const verifyResult = await client.query(verifyQuery);
    console.log(verifyResult.rows[0].table_status);
    console.log(`📋 配置项数量: ${verifyResult.rows[0].config_count}`);
    
    console.log('');
    console.log('🎉 迁移执行成功！');
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // 忽略回滚错误
    }
    console.error('');
    console.error('❌ 数据库迁移执行失败！');
    console.error('错误信息:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    console.error('');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

