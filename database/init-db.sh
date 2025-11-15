#!/bin/bash

# 跟单系统数据库初始化脚本
# 使用方法: bash init-db.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}开始初始化数据库...${NC}"

# 读取 .env 文件中的数据库配置
if [ -f "../backend/.env" ]; then
    source ../backend/.env
else
    echo -e "${YELLOW}警告: 未找到 .env 文件，使用默认配置${NC}"
    DB_HOST=${DB_HOST:-localhost}
    DB_PORT=${DB_PORT:-5432}
    DB_NAME=${DB_NAME:-fangdu_db}
    DB_USER=${DB_USER:-postgres}
    DB_PASSWORD=${DB_PASSWORD:-postgres}
fi

# 设置 PGPASSWORD 环境变量
export PGPASSWORD=$DB_PASSWORD

echo -e "${YELLOW}数据库配置:${NC}"
echo -e "  主机: $DB_HOST"
echo -e "  端口: $DB_PORT"
echo -e "  数据库: $DB_NAME"
echo -e "  用户: $DB_USER"
echo ""

# 检查数据库是否存在
echo -e "${GREEN}检查数据库是否存在...${NC}"
DB_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -w $DB_NAME | wc -l)

if [ $DB_EXISTS -eq 0 ]; then
    echo -e "${YELLOW}数据库不存在，正在创建...${NC}"
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    echo -e "${GREEN}数据库创建成功！${NC}"
else
    echo -e "${GREEN}数据库已存在，跳过创建${NC}"
fi

# 导入数据库结构
echo -e "${GREEN}导入数据库结构...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}数据库结构导入成功！${NC}"
else
    echo -e "${RED}数据库结构导入失败！${NC}"
    exit 1
fi

# 导入初始数据（如果存在）
if [ -f "init.sql" ]; then
    echo -e "${GREEN}导入初始数据...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f init.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}初始数据导入成功！${NC}"
    else
        echo -e "${YELLOW}初始数据导入失败（可能已存在），继续...${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}数据库初始化完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "默认账号信息:"
echo -e "  管理员: admin / admin123"
echo -e "  测试客户: customer001 / admin123"
echo ""

# 清除密码环境变量
unset PGPASSWORD

