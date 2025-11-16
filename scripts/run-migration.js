/**
 * 数据库迁移执行脚本
 * 使用方法：node scripts/run-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 从环境变量或默认值获取数据库配置
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fangdu_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('📦 开始执行数据库迁移...');
    console.log(`📊 数据库: ${pool.options.database}`);
    console.log(`👤 用户: ${pool.options.user}`);
    console.log(`🌐 主机: ${pool.options.host}:${pool.options.port}`);
    console.log('');

    // 读取迁移脚本
    const migrationPath = path.join(
      __dirname,
      '../database/migrations/001_add_production_manager_features.sql'
    );
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`迁移脚本不存在: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // 开始事务
    await client.query('BEGIN');
    console.log('🔄 开始事务...');
    
    // 执行迁移脚本
    await client.query(sql);
    
    // 提交事务
    await client.query('COMMIT');
    console.log('✅ 事务已提交');
    
    // 验证迁移结果
    console.log('');
    console.log('🔍 验证迁移结果...');
    
    const checks = [
      {
        name: 'users.assigned_order_types',
        query: `SELECT column_name FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'assigned_order_types'`,
      },
      {
        name: 'orders.order_type',
        query: `SELECT column_name FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'order_type'`,
      },
      {
        name: 'delivery_reminders.is_admin_assigned',
        query: `SELECT column_name FROM information_schema.columns 
                   WHERE table_name = 'delivery_reminders' AND column_name = 'is_admin_assigned'`,
      },
      {
        name: 'delivery_reminders.assigned_to',
        query: `SELECT column_name FROM information_schema.columns 
                   WHERE table_name = 'delivery_reminders' AND column_name = 'assigned_to'`,
      },
    ];

    let allPassed = true;
    for (const check of checks) {
      const result = await client.query(check.query);
      if (result.rows.length > 0) {
        console.log(`  ✅ ${check.name} - 字段已创建`);
      } else {
        console.log(`  ❌ ${check.name} - 字段未找到`);
        allPassed = false;
      }
    }

    console.log('');
    if (allPassed) {
      console.log('🎉 迁移执行成功！所有字段已创建。');
    } else {
      console.log('⚠️  迁移完成，但部分验证失败，请手动检查。');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('❌ 迁移执行失败！');
    console.error('错误信息:', error.message);
    console.error('');
    console.error('详细错误:');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
runMigration().catch((error) => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

