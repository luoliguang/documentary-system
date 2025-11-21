#!/bin/bash
# ============================================
# 跟单系统 - 宝塔面板一键部署脚本
# 适用于：宝塔面板环境，不影响其他项目
# ============================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目配置（适配宝塔面板路径）
if [ -d "/www/wwwroot" ]; then
    PROJECT_DIR="/www/wwwroot/fangdu-system"
    LOG_DIR="/www/wwwlogs/fangdu"
else
    PROJECT_DIR="/var/www/fangdu-system"
    LOG_DIR="/var/log/fangdu"
fi

PROJECT_NAME="fangdu-system"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "============================================"
echo "🚀 开始部署跟单系统（宝塔面板版）..."
echo "============================================"

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 1. 拉取最新代码（如果使用 git）
if [ -d ".git" ]; then
    echo "📥 拉取最新代码..."
    git pull origin master || git pull origin main || true
fi

# 2. 依赖与构建（不在云服务器上执行 npm run build）
echo "📦 跳过服务器端构建（npm run build）"
echo "   请确保已在本地执行构建，并将以下内容上传到服务器："
echo "   - frontend/dist  前端打包后的静态文件"
echo "   - backend/dist   后端打包后的 JS 文件"
echo ""
echo "   如需在服务器上仅安装后端运行依赖（不含构建），可手动执行："
echo "     cd backend && npm install --only=production && cd .."
echo ""

# 3. 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  警告: .env 文件不存在，正在创建示例文件...${NC}"
    if [ -f "deploy/env.example" ]; then
        cp deploy/env.example .env
    elif [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo -e "${RED}❌ 错误: 找不到 env.example 文件，请手动创建 .env 文件${NC}"
        exit 1
    fi
    echo -e "${YELLOW}⚠️  请编辑 .env 文件并填入正确的配置信息！${NC}"
    echo "   按 Enter 继续（确保已配置好 .env）..."
    read
fi

# 4. 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p backend/uploads
mkdir -p $LOG_DIR

# 5. 启动/重启 PM2 服务
echo "🔄 启动 PM2 服务..."

# 停止旧服务（如果存在）
pm2 delete $PROJECT_NAME-backend 2>/dev/null || true

# 启动后端服务（使用项目目录的绝对路径）
cd backend
pm2 start dist/index.js \
    --name "$PROJECT_NAME-backend" \
    --log "$LOG_DIR/backend.log" \
    --error "$LOG_DIR/backend-error.log" \
    --time \
    --restart-delay=3000 \
    --max-restarts=10 \
    --exp-backoff-restart-delay=100 \
    --cwd $(pwd)

cd ..

# 6. 保存 PM2 配置
pm2 save

# 7. 设置 PM2 开机自启（如果可能）
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null | grep -v PM2 || {
    echo "⚠️  PM2 开机自启配置需要 root 权限，请手动执行:"
    echo "   sudo pm2 startup systemd -u $USER --hp $HOME"
}

echo ""
echo "============================================"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "============================================"
echo ""
echo "📊 服务状态："
pm2 list
echo ""
echo "📝 查看日志："
echo "   pm2 logs $PROJECT_NAME-backend"
echo ""
echo "🔄 重启服务："
echo "   pm2 restart $PROJECT_NAME-backend"
echo ""
echo "🌐 下一步："
echo "   1. 在宝塔面板中添加站点（域名）"
echo "   2. 配置反向代理到 http://127.0.0.1:3006"
echo "   3. 设置网站根目录为: $FRONTEND_DIR/dist"
echo "   4. 配置 SSL 证书"
echo ""
echo "📖 详细配置请查看: deploy/宝塔面板部署指南.md"
echo ""

