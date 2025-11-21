#!/bin/bash
# ============================================
# 数据库表结构初始化脚本（适配宝塔面板）
# ============================================

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 项目根目录：从 deploy/database 向上两级
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 检测 PostgreSQL 路径（宝塔面板或系统）
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL_CMD="/www/server/pgsql/bin/psql"
    # 将 psql 添加到 PATH（用于当前脚本）
    export PATH="/www/server/pgsql/bin:$PATH"
    echo "✅ 检测到宝塔面板 PostgreSQL"
elif command -v psql &> /dev/null; then
    PSQL_CMD="psql"
    echo "✅ 使用系统 PostgreSQL"
else
    echo "❌ 错误: 未找到 PostgreSQL，请先安装 PostgreSQL"
    echo "   提示: 宝塔面板 PostgreSQL 路径: /www/server/pgsql/bin/psql"
    exit 1
fi

# 读取环境变量
if [ -f "$PROJECT_ROOT/.env" ]; then
    # 安全地加载环境变量（处理 Windows 换行符）
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        # 跳过注释行和空行
        line=$(echo "$line" | sed 's/\r$//' | sed 's/#.*$//')
        [ -z "$line" ] && continue
        # 只处理 KEY=value 格式的行
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            export "$line"
        fi
    done < "$PROJECT_ROOT/.env"
    set +a
fi

DB_NAME=${DB_NAME:-fangdu_db}
DB_USER=${DB_USER:-fangdu_user}
DB_PASSWORD=${DB_PASSWORD:-Fangdu@2024!Secure}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "============================================"
echo "🗄️  开始初始化数据库表结构..."
echo "============================================"
echo "📝 连接信息："
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Project Root: $PROJECT_ROOT"
echo ""

# 设置 PostgreSQL 密码环境变量
export PGPASSWORD=$DB_PASSWORD

# 检查 schema.sql 文件
SCHEMA_FILE="$PROJECT_ROOT/database/schema.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ 错误: 找不到 schema.sql 文件"
    echo "   期望路径: $SCHEMA_FILE"
    echo "   当前目录: $(pwd)"
    echo "   项目根目录: $PROJECT_ROOT"
    exit 1
fi

# 执行 schema.sql
echo "📦 执行 schema.sql..."
echo "   文件路径: $SCHEMA_FILE"
$PSQL_CMD -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$SCHEMA_FILE"

# 执行 init.sql（如果存在）
INIT_FILE="$PROJECT_ROOT/database/init.sql"
if [ -f "$INIT_FILE" ]; then
    echo "📦 执行 init.sql..."
    $PSQL_CMD -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$INIT_FILE"
fi

# 执行迁移脚本
echo "📦 执行数据库迁移..."
MIGRATIONS_DIR="$PROJECT_ROOT/database/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    for migration in $(ls -v "$MIGRATIONS_DIR"/*.sql 2>/dev/null); do
        echo "   执行: $(basename $migration)"
        $PSQL_CMD -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration"
    done
else
    echo "   ⚠️  迁移目录不存在: $MIGRATIONS_DIR"
fi

# 清除密码环境变量
unset PGPASSWORD

echo ""
echo "✅ 数据库初始化完成！"

