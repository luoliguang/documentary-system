#!/bin/bash
# ============================================
# Let's Encrypt SSL 证书安装脚本
# ============================================

set -e

echo "============================================"
echo "🔒 安装 Let's Encrypt SSL 证书..."
echo "============================================"

# 检查域名参数
if [ -z "$1" ]; then
    echo "❌ 错误: 请提供域名"
    echo "使用方法: ./install-ssl.sh your-domain.com"
    exit 1
fi

DOMAIN=$1
EMAIL=${2:-admin@$DOMAIN}

echo "📝 域名: $DOMAIN"
echo "📝 邮箱: $EMAIL"
echo ""

# 安装 certbot
echo "📦 安装 certbot..."
sudo yum install -y certbot python3-certbot-nginx

# 创建验证目录
sudo mkdir -p /var/www/certbot

# 获取证书（使用 Nginx 插件自动配置）
echo "🔐 获取 SSL 证书..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

# 设置自动续期
echo "🔄 设置自动续期..."
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer

echo ""
echo "✅ SSL 证书安装完成！"
echo ""
echo "📝 证书位置:"
echo "   /etc/letsencrypt/live/$DOMAIN/"
echo ""
echo "🔄 手动续期: sudo certbot renew"
echo "📊 查看证书: sudo certbot certificates"
echo ""

