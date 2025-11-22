#!/bin/bash

# 项目大扫除脚本
# 用法: ./clean-project.sh [--dry-run|--force]

set -e

DRY_RUN=false
FORCE=false

# 解析参数
if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
elif [ "$1" == "--force" ]; then
    FORCE=true
else
    echo "用法: $0 [--dry-run|--force]"
    echo "  --dry-run: 预览要删除的文件（不实际删除）"
    echo "  --force:   实际删除文件"
    exit 1
fi

# 白名单（永远不删）
WHITELIST=(
    "README.md"
    "ARCHITECTURE.md"
    "GOD.md"
    "CURSOR_RULES.md"
    "SETUP.md"
)

# 检查文件是否在白名单
is_whitelisted() {
    local file="$1"
    local basename=$(basename "$file")
    for w in "${WHITELIST[@]}"; do
        if [ "$basename" == "$w" ]; then
            return 0
        fi
    done
    # 迁移文件：数字开头的保留
    if [[ "$basename" =~ ^[0-9]+_.*\.sql$ ]]; then
        return 0
    fi
    return 1
}

# 要删除的文件列表
FILES_TO_DELETE=()

# 1. 删除垃圾 MD 文件
echo "🔍 扫描垃圾 MD 文件..."
while IFS= read -r -d '' file; do
    if is_whitelisted "$file"; then
        continue
    fi
    basename=$(basename "$file")
    if [[ "$basename" =~ (TEMP|TODO|PLAN|NEW|DRAFT|v2|backup|copy|EXPLAIN|NOTE|TEMP|_TEMP|_TODO|_PLAN|_NEW|_DRAFT|_v2|_backup|_copy) ]]; then
        FILES_TO_DELETE+=("$file")
    fi
done < <(find . -type f -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" -print0)

# 2. 删除测试/脚本垃圾
echo "🔍 扫描测试/脚本垃圾..."

# __tests__ 下非 *.test.ts 的文件
while IFS= read -r -d '' file; do
    if [[ ! "$file" =~ \.test\.ts$ ]]; then
        FILES_TO_DELETE+=("$file")
    fi
done < <(find . -type f -path "*/__tests__/*" -not -name "*.test.ts" -not -path "./node_modules/*" -not -path "./.git/*" -print0)

# scripts/ 下带 temp/old/backup/test/draft 的文件
while IFS= read -r -d '' file; do
    basename=$(basename "$file")
    if [[ "$basename" =~ (temp|old|backup|test|draft|TEMP|OLD|BACKUP|TEST|DRAFT) ]]; then
        FILES_TO_DELETE+=("$file")
    fi
done < <(find ./scripts -type f -not -path "./node_modules/*" -not -path "./.git/*" -print0 2>/dev/null || true)

# 根目录下 test-*.js、demo-*.ts、tmp-*.sql
while IFS= read -r -d '' file; do
    basename=$(basename "$file")
    if [[ "$basename" =~ ^(test-.*\.js|demo-.*\.ts|tmp-.*\.sql)$ ]]; then
        FILES_TO_DELETE+=("$file")
    fi
done < <(find . -maxdepth 1 -type f \( -name "test-*.js" -o -name "demo-*.ts" -o -name "tmp-*.sql" \) -not -path "./node_modules/*" -not -path "./.git/*" -print0)

# 3. 删除迁移草稿
echo "🔍 扫描迁移草稿..."
while IFS= read -r -d '' file; do
    if is_whitelisted "$file"; then
        continue
    fi
    basename=$(basename "$file")
    if [[ "$basename" =~ (draft|temp|old|backup|copy|DRAFT|TEMP|OLD|BACKUP|COPY) ]]; then
        FILES_TO_DELETE+=("$file")
    fi
done < <(find ./database/migrations -type f -name "*.sql" -not -path "./node_modules/*" -not -path "./.git/*" -print0 2>/dev/null || true)

# 去重
IFS=$'\n' FILES_TO_DELETE=($(printf '%s\n' "${FILES_TO_DELETE[@]}" | sort -u))

# 显示结果
if [ ${#FILES_TO_DELETE[@]} -eq 0 ]; then
    echo "✅ 没有发现垃圾文件！"
    exit 0
fi

echo ""
echo "📋 发现 ${#FILES_TO_DELETE[@]} 个垃圾文件："
echo ""

for file in "${FILES_TO_DELETE[@]}"; do
    echo "  🗑️  $file"
done

echo ""

if [ "$DRY_RUN" == true ]; then
    echo "🔍 预览模式：未实际删除文件"
    echo "   如需实际删除，请运行: $0 --force"
    exit 0
fi

if [ "$FORCE" == true ]; then
    echo "⚠️  即将删除以上文件..."
    read -p "确认删除？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 已取消"
        exit 1
    fi
    
    DELETED=0
    for file in "${FILES_TO_DELETE[@]}"; do
        if [ -f "$file" ]; then
            rm -f "$file"
            DELETED=$((DELETED + 1))
        fi
    done
    
    echo ""
    echo "✅ 清理完成！删除了 $DELETED 个垃圾文件"
else
    echo "❌ 请使用 --dry-run 或 --force 参数"
    exit 1
fi

