#!/bin/bash
# ============================================
# 健康检查脚本
# ============================================

echo "============================================"
echo "🏥 系统健康检查"
echo "============================================"

# 检查 PM2 服务
echo "📊 PM2 服务状态:"
pm2 list

echo ""
echo "📝 后端服务日志（最近10行）:"
pm2 logs fangdu-backend --lines 10 --nostream

echo ""
echo "🔍 测试后端 API:"
BACKEND_URL="http://localhost:3006/health"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" $BACKEND_URL)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 后端 API 正常 (HTTP $HTTP_CODE)"
    echo "   响应: $BODY"
else
    echo "❌ 后端 API 异常 (HTTP $HTTP_CODE)"
    echo "   响应: $BODY"
fi

echo ""
echo "🗄️  PostgreSQL 服务状态:"
sudo systemctl status postgresql-15 --no-pager -l | head -5

echo ""
echo "🌐 Nginx 服务状态:"
sudo systemctl status nginx --no-pager -l | head -5

echo ""
echo "📦 端口占用情况:"
echo "   3006 (后端): $(sudo netstat -tlnp | grep :3006 || echo '未监听')"
echo "   80 (HTTP): $(sudo netstat -tlnp | grep :80 || echo '未监听')"
echo "   443 (HTTPS): $(sudo netstat -tlnp | grep :443 || echo '未监听')"

echo ""
echo "============================================"
echo "✅ 健康检查完成"
echo "============================================"

