#!/bin/bash
# ============================================
# 跟单系统 - 服务器环境准备脚本
# 适用于：Alibaba Cloud Linux 3.2104 LTS
# ============================================

set -e  # 遇到错误立即退出

echo "============================================"
echo "🚀 开始准备服务器环境..."
echo "============================================"

# 1. 更新系统
echo "📦 更新系统包..."
sudo yum update -y

# 2. 安装基础工具
echo "📦 安装基础工具 (git, wget, curl)..."
sudo yum install -y git wget curl

# 3. 安装 Node.js 18+
echo "📦 安装 Node.js 18..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证 Node.js 版本
node_version=$(node -v)
npm_version=$(npm -v)
echo "✅ Node.js 版本: $node_version"
echo "✅ npm 版本: $npm_version"

# 4. 安装 PM2
echo "📦 安装 PM2..."
sudo npm install -g pm2

# 5. 安装 PostgreSQL
echo "📦 安装 PostgreSQL..."
sudo yum install -y postgresql15-server postgresql15

# 初始化 PostgreSQL（如果未初始化）
if [ ! -d "/var/lib/pgsql/15/data" ]; then
    echo "📦 初始化 PostgreSQL 数据库..."
    sudo /usr/pgsql-15/bin/postgresql-15-setup initdb
fi

# 启动 PostgreSQL 服务
echo "📦 启动 PostgreSQL 服务..."
sudo systemctl enable postgresql-15
sudo systemctl start postgresql-15

# 6. 安装 Nginx
echo "📦 安装 Nginx..."
sudo yum install -y nginx

# 启动 Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 7. 配置防火墙（如果使用 firewalld）
echo "📦 配置防火墙端口..."
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-port=3006/tcp
    sudo firewall-cmd --permanent --add-port=5432/tcp
    sudo firewall-cmd --reload
    echo "✅ 防火墙规则已添加"
fi

# 8. 创建项目目录
echo "📦 创建项目目录..."
PROJECT_DIR="/var/www/fangdu-system"
sudo mkdir -p $PROJECT_DIR
sudo chown -R $USER:$USER $PROJECT_DIR

# 9. 创建日志目录
echo "📦 创建日志目录..."
sudo mkdir -p /var/log/fangdu
sudo chown -R $USER:$USER /var/log/fangdu

echo "============================================"
echo "✅ 服务器环境准备完成！"
echo "============================================"
echo ""
echo "📝 下一步操作："
echo "1. 配置 PostgreSQL 数据库（运行 database/setup-db.sh）"
echo "2. 上传项目代码到 $PROJECT_DIR"
echo "3. 运行部署脚本 deploy.sh"
echo ""

