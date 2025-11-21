#!/bin/bash
# ============================================
# 代码更新脚本（用于 Git Hook 或手动执行）
# ============================================

set -e

PROJECT_DIR="/var/www/fangdu-system"
cd $PROJECT_DIR

echo "============================================"
echo "🔄 开始更新代码..."
echo "============================================"

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin master || git pull origin main

# 安装依赖
echo "📦 更新依赖..."
npm install
cd frontend && npm install && npm run build && cd ..
cd backend && npm install && npm run build && cd ..

# 重启服务
echo "🔄 重启服务..."
pm2 restart fangdu-backend

echo ""
echo "✅ 代码更新完成！"
echo ""

