#!/bin/bash
# ============================================
# 跟单系统 - 一键部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh
# ============================================

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_DIR="/var/www/fangdu-system"
PROJECT_NAME="fangdu-system"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "============================================"
echo "🚀 开始部署跟单系统..."
echo "============================================"

# 检查是否在项目目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

# 1. 拉取最新代码（如果使用 git）
if [ -d ".git" ]; then
    echo "📥 拉取最新代码..."
    git pull origin master || git pull origin main
fi

# 2. 安装依赖
echo "📦 安装根目录依赖..."
npm install

echo "📦 安装前端依赖..."
cd frontend
npm install
npm run build
cd ..

echo "📦 安装后端依赖..."
cd backend
npm install
npm run build
cd ..

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

# 4. 初始化数据库（如果需要，首次部署时手动执行）
echo "🗄️  数据库初始化..."
echo "   提示: 如果是首次部署，请先运行:"
echo "   cd deploy/database && ./setup-db.sh && ./init-database.sh"
echo "   按 Enter 跳过数据库初始化，或按 Ctrl+C 退出先初始化数据库..."
read -t 3 || true

# 5. 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p backend/uploads
mkdir -p /var/log/fangdu

# 6. 启动/重启 PM2 服务
echo "🔄 启动 PM2 服务..."

# 停止旧服务（如果存在）
pm2 delete $PROJECT_NAME-backend 2>/dev/null || true
pm2 delete $PROJECT_NAME-frontend 2>/dev/null || true

# 启动后端服务
cd backend
pm2 start dist/index.js \
    --name "$PROJECT_NAME-backend" \
    --log /var/log/fangdu/backend.log \
    --error /var/log/fangdu/backend-error.log \
    --time \
    --restart-delay=3000 \
    --max-restarts=10 \
    --exp-backoff-restart-delay=100

cd ..

# 启动前端服务（如果需要，通常前端是静态文件，由 Nginx 提供）
# 如果前端需要 Node.js 服务，取消下面的注释
# cd frontend
# pm2 start npm --name "$PROJECT_NAME-frontend" -- start
# cd ..

# 7. 保存 PM2 配置
pm2 save

# 8. 设置 PM2 开机自启
pm2 startup systemd -u $USER --hp /home/$USER | grep -v PM2 || true

# 9. 重新加载 Nginx（如果配置已更新）
if [ -f "/etc/nginx/conf.d/fangdu.conf" ]; then
    echo "🔄 重新加载 Nginx..."
    sudo nginx -t && sudo systemctl reload nginx
fi

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
echo "   pm2 logs $PROJECT_NAME-frontend"
echo ""
echo "🔄 重启服务："
echo "   pm2 restart $PROJECT_NAME-backend"
echo ""
echo "🌐 访问地址："
echo "   前端: http://your-domain.com"
echo "   后端API: http://your-domain.com/api"
echo ""

