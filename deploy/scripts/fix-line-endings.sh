#!/bin/bash
# ============================================
# 修复脚本文件的换行符（Windows -> Unix）
# ============================================

echo "============================================"
echo "🔧 修复脚本文件换行符..."
echo "============================================"

# 检查是否安装了 dos2unix
if ! command -v dos2unix &> /dev/null; then
    echo "📦 安装 dos2unix..."
    if command -v yum &> /dev/null; then
        sudo yum install -y dos2unix
    elif command -v apt-get &> /dev/null; then
        sudo apt-get install -y dos2unix
    else
        echo "⚠️  无法自动安装 dos2unix，请手动安装"
        echo "   或使用 sed 命令手动转换"
    fi
fi

# 修复所有脚本文件
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "📝 修复数据库脚本..."
if [ -f "$PROJECT_ROOT/deploy/database/setup-db.sh" ]; then
    dos2unix "$PROJECT_ROOT/deploy/database/setup-db.sh" 2>/dev/null || \
    sed -i 's/\r$//' "$PROJECT_ROOT/deploy/database/setup-db.sh"
    echo "   ✅ setup-db.sh"
fi

if [ -f "$PROJECT_ROOT/deploy/database/init-database.sh" ]; then
    dos2unix "$PROJECT_ROOT/deploy/database/init-database.sh" 2>/dev/null || \
    sed -i 's/\r$//' "$PROJECT_ROOT/deploy/database/init-database.sh"
    echo "   ✅ init-database.sh"
fi

echo "📝 修复部署脚本..."
if [ -f "$PROJECT_ROOT/deploy/deploy-baota.sh" ]; then
    dos2unix "$PROJECT_ROOT/deploy/deploy-baota.sh" 2>/dev/null || \
    sed -i 's/\r$//' "$PROJECT_ROOT/deploy/deploy-baota.sh"
    echo "   ✅ deploy-baota.sh"
fi

if [ -f "$PROJECT_ROOT/deploy/server-setup-baota.sh" ]; then
    dos2unix "$PROJECT_ROOT/deploy/server-setup-baota.sh" 2>/dev/null || \
    sed -i 's/\r$//' "$PROJECT_ROOT/deploy/server-setup-baota.sh"
    echo "   ✅ server-setup-baota.sh"
fi

echo ""
echo "✅ 换行符修复完成！"
echo ""

