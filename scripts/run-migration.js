/**
 * 统一数据库迁移执行脚本
 * 自动查找并执行所有未执行的迁移文件
 * 使用方法：node scripts/run-migration.js
 */

const fs = require('fs');
const path = require('path');

// 添加 backend 的 node_modules 到模块搜索路径
const backendNodeModules = path.resolve(__dirname, '../backend/node_modules');
const originalPaths = module.paths.slice();
module.paths = [backendNodeModules, ...originalPaths];

// 加载 dotenv（从 backend 目录）
const dotenvPath = path.join(__dirname, '../backend/.env');
if (fs.existsSync(dotenvPath)) {
  const dotenvModule = path.join(backendNodeModules, 'dotenv');
  if (fs.existsSync(dotenvModule)) {
    require(dotenvModule).config({ path: dotenvPath });
  } else {
    require('dotenv').config({ path: dotenvPath });
  }
} else {
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

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('📦 开始执行数据库迁移...');
    console.log(`📊 数据库: ${pool.options.database}`);
    console.log(`👤 用户: ${pool.options.user}`);
    console.log(`🌐 主机: ${pool.options.host}:${pool.options.port}`);
    console.log('');

    // 创建迁移记录表（如果不存在）
    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        migration_file VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 获取已执行的迁移文件列表
    const executedResult = await client.query(
      'SELECT migration_file FROM migration_history ORDER BY id'
    );
    const executedFiles = new Set(executedResult.rows.map(row => row.migration_file));

    // 查找所有迁移文件（格式：数字_描述.sql）
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const allFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql') && /^\d+_/.test(file))
      .map(file => ({
        name: file,
        number: parseInt(file.match(/^(\d+)_/)[1]),
        path: path.join(migrationsDir, file)
      }))
      .sort((a, b) => a.number - b.number);

    // 过滤出未执行的迁移
    const pendingMigrations = allFiles.filter(file => !executedFiles.has(file.name));

    if (pendingMigrations.length === 0) {
      console.log('✅ 所有迁移已执行，无需执行新的迁移');
      return;
    }

    console.log(`📋 找到 ${pendingMigrations.length} 个待执行的迁移文件:`);
    pendingMigrations.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.name}`);
    });
    console.log('');

    // 执行所有待执行的迁移
    for (let i = 0; i < pendingMigrations.length; i++) {
      const migration = pendingMigrations[i];
      console.log(`🔄 [${i + 1}/${pendingMigrations.length}] 执行迁移: ${migration.name}...`);

      try {
        await client.query('BEGIN');
        const sql = fs.readFileSync(migration.path, 'utf8');
        await client.query(sql);
        
        // 记录迁移执行历史
        await client.query(
          'INSERT INTO migration_history (migration_file) VALUES ($1)',
          [migration.name]
        );
        
        await client.query('COMMIT');
        console.log(`   ✅ ${migration.name} 执行成功`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`   ❌ ${migration.name} 执行失败`);
        throw error;
      }
    }

    console.log('');
    console.log('🎉 所有迁移执行成功！');

  } catch (error) {
    console.error('');
    console.error('❌ 数据库迁移执行失败！');
    console.error('错误信息:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.detail) {
      console.error('详细信息:', error.detail);
    }
    console.error('');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
