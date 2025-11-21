#!/bin/bash
# ============================================
# 数据库初始化脚本（适配宝塔面板）
# ============================================

set -e

echo "============================================"
echo "🗄️  开始配置 PostgreSQL 数据库..."
echo "============================================"

# 检测 PostgreSQL 路径（宝塔面板或系统）
if [ -f "/www/server/pgsql/bin/psql" ]; then
    PSQL_CMD="/www/server/pgsql/bin/psql"
    echo "✅ 检测到宝塔面板 PostgreSQL"
elif command -v psql &> /dev/null; then
    PSQL_CMD="psql"
    echo "✅ 使用系统 PostgreSQL"
else
    echo "❌ 错误: 未找到 PostgreSQL，请先安装 PostgreSQL"
    exit 1
fi

# 读取环境变量（如果存在）
if [ -f "../../.env" ]; then
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

# 检测 PostgreSQL 超级用户
# 宝塔面板通常使用 root 或 postgres 用户
if [ -f "/www/server/pgsql/bin/psql" ]; then
    # 宝塔面板：尝试使用 root 用户连接
    if sudo -u root $PSQL_CMD -U postgres -c "SELECT 1" &>/dev/null; then
        PG_SUPERUSER="postgres"
        PG_SUDO_USER="root"
    elif sudo -u root $PSQL_CMD -U root -c "SELECT 1" &>/dev/null; then
        PG_SUPERUSER="root"
        PG_SUDO_USER="root"
    else
        # 尝试直接连接（宝塔面板可能允许 root 直接连接）
        PG_SUPERUSER="postgres"
        PG_SUDO_USER=""
    fi
else
    # 系统 PostgreSQL：使用 postgres 用户
    PG_SUPERUSER="postgres"
    PG_SUDO_USER="postgres"
fi

echo "📝 使用 PostgreSQL 超级用户: $PG_SUPERUSER"

# 执行数据库操作
if [ -n "$PG_SUDO_USER" ]; then
    sudo -u $PG_SUDO_USER $PSQL_CMD -U $PG_SUPERUSER <<EOF
-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- 创建用户（如果不存在）
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\q
EOF
else
    $PSQL_CMD -U $PG_SUPERUSER <<EOF
-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- 创建用户（如果不存在）
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\q
EOF
fi

# 连接到目标数据库授予 schema 权限（使用超级用户）
# 宝塔面板需要使用超级用户授予权限
if [ -n "$PG_SUDO_USER" ]; then
    # 使用超级用户连接并授予权限
    sudo -u $PG_SUDO_USER $PSQL_CMD -U $PG_SUPERUSER -d $DB_NAME <<EOF
-- 授予 schema 所有权或所有权限
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER SCHEMA public OWNER TO $DB_USER;

-- 授予创建表的权限
GRANT CREATE ON SCHEMA public TO $DB_USER;

-- 授予所有现有表的权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- 设置默认权限（未来创建的表和序列）
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

-- 确保用户有创建表的权限
ALTER USER $DB_USER CREATEDB;

\q
EOF
else
    # 直接使用超级用户
    $PSQL_CMD -U $PG_SUPERUSER -d $DB_NAME <<EOF
-- 授予 schema 所有权或所有权限
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER SCHEMA public OWNER TO $DB_USER;

-- 授予创建表的权限
GRANT CREATE ON SCHEMA public TO $DB_USER;

-- 授予所有现有表的权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

-- 确保用户有创建表的权限
ALTER USER $DB_USER CREATEDB;

\q
EOF
fi

echo "✅ 数据库和用户创建成功！"
echo ""
echo "📝 数据库连接信息："
echo "   DB_HOST=localhost"
echo "   DB_PORT=5432"
echo "   DB_NAME=$DB_NAME"
echo "   DB_USER=$DB_USER"
echo "   DB_PASSWORD=$DB_PASSWORD"
echo ""
echo "⚠️  请将以上信息保存到 .env 文件中！"

