#!/bin/bash
# ============================================
# 跟单系统 - 宝塔面板环境准备脚本
# 适用于：阿里云 ECS + 宝塔面板
# 注意：不会影响现有项目
# ============================================

set -e  # 遇到错误立即退出

echo "============================================"
echo "🚀 开始准备服务器环境（宝塔面板版）..."
echo "============================================"

# 检测宝塔面板
if [ -d "/www/server/panel" ]; then
    echo "✅ 检测到宝塔面板已安装"
    BT_PANEL=true
else
    echo "⚠️  未检测到宝塔面板，将使用标准安装方式"
    BT_PANEL=false
fi

# 1. 安装基础工具（如果未安装）
echo "📦 检查基础工具..."
if ! command -v git &> /dev/null; then
    echo "   安装 git..."
    sudo yum install -y git
fi

if ! command -v wget &> /dev/null; then
    echo "   安装 wget..."
    sudo yum install -y wget
fi

# 2. 安装 Node.js 18+（如果未安装）
if ! command -v node &> /dev/null; then
    echo "📦 安装 Node.js 18..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
else
    echo "✅ Node.js 已安装: $(node -v)"
fi

# 验证 Node.js 版本
node_version=$(node -v)
npm_version=$(npm -v)
echo "✅ Node.js 版本: $node_version"
echo "✅ npm 版本: $npm_version"

# 3. 安装 PM2（如果未安装）
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    sudo npm install -g pm2
else
    echo "✅ PM2 已安装: $(pm2 -v)"
fi

# 4. 数据库配置（宝塔面板已管理，只检查）
if [ "$BT_PANEL" = true ]; then
    echo "📦 检测宝塔面板数据库..."
    echo "   提示: 请在宝塔面板中创建 PostgreSQL 或 MySQL 数据库"
    echo "   或使用宝塔面板已存在的数据库"
    
    # 检查 PostgreSQL（宝塔面板路径）
    if [ -d "/www/server/pgsql" ]; then
        echo "✅ 检测到宝塔面板 PostgreSQL"
        PGSQL_VERSION=$(ls /www/server/pgsql/ | grep -E '^[0-9]' | head -1)
        echo "   PostgreSQL 版本: $PGSQL_VERSION"
    fi
    
    # 检查 MySQL（宝塔面板路径）
    if [ -d "/www/server/mysql" ]; then
        echo "✅ 检测到宝塔面板 MySQL"
        MYSQL_VERSION=$(ls /www/server/mysql/ | grep -E '^[0-9]' | head -1)
        echo "   MySQL 版本: $MYSQL_VERSION"
    fi
else
    # 非宝塔环境，安装 PostgreSQL
    echo "📦 安装 PostgreSQL..."
    if ! command -v psql &> /dev/null; then
        sudo yum install -y postgresql15-server postgresql15
        if [ ! -d "/var/lib/pgsql/15/data" ]; then
            echo "📦 初始化 PostgreSQL 数据库..."
            sudo /usr/pgsql-15/bin/postgresql-15-setup initdb
        fi
        sudo systemctl enable postgresql-15
        sudo systemctl start postgresql-15
    else
        echo "✅ PostgreSQL 已安装"
    fi
fi

# 5. Nginx 配置（宝塔面板已管理，跳过）
if [ "$BT_PANEL" = true ]; then
    echo "✅ 宝塔面板已管理 Nginx，无需手动安装"
    echo "   提示: 请在宝塔面板中添加站点并配置反向代理"
else
    echo "📦 检查 Nginx..."
    if ! command -v nginx &> /dev/null; then
        sudo yum install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
    else
        echo "✅ Nginx 已安装"
    fi
fi

# 6. 配置防火墙（宝塔面板已管理，只添加后端端口）
echo "📦 配置防火墙端口..."
if systemctl is-active --quiet firewalld; then
    # 只添加后端 API 端口（3006），80/443 由宝塔管理
    sudo firewall-cmd --permanent --add-port=3006/tcp 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
    echo "✅ 已添加后端端口 3006"
fi

# 7. 创建项目目录（使用宝塔面板常用路径或自定义）
echo "📦 创建项目目录..."
if [ "$BT_PANEL" = true ]; then
    # 宝塔面板常用路径
    PROJECT_DIR="/www/wwwroot/fangdu-system"
    echo "   使用宝塔面板路径: $PROJECT_DIR"
else
    PROJECT_DIR="/var/www/fangdu-system"
fi

sudo mkdir -p $PROJECT_DIR
sudo chown -R $USER:$USER $PROJECT_DIR 2>/dev/null || sudo chown -R www:www $PROJECT_DIR

# 8. 创建日志目录
echo "📦 创建日志目录..."
LOG_DIR="/www/wwwlogs/fangdu" 2>/dev/null || LOG_DIR="/var/log/fangdu"
sudo mkdir -p $LOG_DIR
sudo chown -R $USER:$USER $LOG_DIR 2>/dev/null || sudo chown -R www:www $LOG_DIR

echo "============================================"
echo "✅ 服务器环境准备完成！"
echo "============================================"
echo ""
echo "📝 下一步操作："
if [ "$BT_PANEL" = true ]; then
    echo "1. 在宝塔面板中创建数据库（PostgreSQL 或 MySQL）"
    echo "2. 上传项目代码到 $PROJECT_DIR"
    echo "3. 在宝塔面板中添加站点并配置反向代理"
    echo "4. 运行部署脚本: cd $PROJECT_DIR && ./deploy/deploy-baota.sh"
else
    echo "1. 配置 PostgreSQL 数据库（运行 database/setup-db.sh）"
    echo "2. 上传项目代码到 $PROJECT_DIR"
    echo "3. 运行部署脚本 deploy.sh"
fi
echo ""

