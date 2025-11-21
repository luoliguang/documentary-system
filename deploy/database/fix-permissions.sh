#!/bin/bash
# ============================================
# 修复数据库用户权限脚本
# 用于解决 "permission denied for schema public" 错误
# ============================================

set -e

echo "============================================"
echo "🔧 修复数据库用户权限..."
echo "============================================"

# 检测 PostgreSQL 路径
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL_CMD="/www/server/pgsql/bin/psql"
    export PATH="/www/server/pgsql/bin:$PATH"
    echo "✅ 检测到宝塔面板 PostgreSQL"
elif command -v psql &> /dev/null; then
    PSQL_CMD="psql"
    echo "✅ 使用系统 PostgreSQL"
else
    echo "❌ 错误: 未找到 PostgreSQL"
    exit 1
fi

# 读取环境变量
if [ -f "../../.env" ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        line=$(echo "$line" | sed 's/\r$//' | sed 's/#.*$//')
        [ -z "$line" ] && continue
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            export "$line"
        fi
    done < ../../.env
    set +a
elif [ -f "../.env" ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        line=$(echo "$line" | sed 's/\r$//' | sed 's/#.*$//')
        [ -z "$line" ] && continue
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            export "$line"
        fi
    done < ../.env
    set +a
fi

# 设置默认值
DB_NAME=${DB_NAME:-fangdu_db}
DB_USER=${DB_USER:-fangdu_user}
DB_PASSWORD=${DB_PASSWORD:-Fangdu@2024!Secure}

echo "📝 数据库配置："
echo "   数据库名: $DB_NAME"
echo "   用户名: $DB_USER"
echo ""

# 检测超级用户
if [ -f "/www/server/pgsql/bin/psql" ]; then
    # 宝塔面板：尝试使用 root 用户
    if sudo -u root $PSQL_CMD -U postgres -c "SELECT 1" &>/dev/null; then
        PG_SUPERUSER="postgres"
        PG_SUDO_USER="root"
    else
        PG_SUPERUSER="postgres"
        PG_SUDO_USER=""
    fi
else
    PG_SUPERUSER="postgres"
    PG_SUDO_USER="postgres"
fi

echo "📝 使用 PostgreSQL 超级用户: $PG_SUPERUSER"
echo ""

# 授予权限
echo "🔧 授予数据库用户权限..."
if [ -n "$PG_SUDO_USER" ]; then
    sudo -u $PG_SUDO_USER $PSQL_CMD -U $PG_SUPERUSER -d $DB_NAME <<EOF
-- 授予 schema 所有权
ALTER SCHEMA public OWNER TO $DB_USER;

-- 授予所有权限
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT CREATE ON SCHEMA public TO $DB_USER;

-- 授予所有现有表的权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;

-- 设置默认权限（未来创建的对象）
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $DB_USER;

-- 确保用户有创建数据库的权限（如果需要）
ALTER USER $DB_USER CREATEDB;

\q
EOF
else
    $PSQL_CMD -U $PG_SUPERUSER -d $DB_NAME <<EOF
-- 授予 schema 所有权
ALTER SCHEMA public OWNER TO $DB_USER;

-- 授予所有权限
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT CREATE ON SCHEMA public TO $DB_USER;

-- 授予所有现有表的权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $DB_USER;

-- 确保用户有创建数据库的权限
ALTER USER $DB_USER CREATEDB;

\q
EOF
fi

echo ""
echo "✅ 权限修复完成！"
echo ""
echo "📝 现在可以重新运行数据库初始化脚本："
echo "   ./init-database.sh"
echo ""

