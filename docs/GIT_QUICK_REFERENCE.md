# Git 快速参考 - 文件提交规则

## ✅ 必须提交的文件

### 架构文档
```
ARCHITECTURE.md
docs/adr/*.md
docs/diagrams/*.png
docs/architecture-roadmap.md
```

### 数据库文档
```
database/schema.sql
database/init.sql
database/migrations/*.sql
docs/database/*.sql
database/test-data-example.sql  # 仅脱敏版本
```

### 项目文档
```
README.md
SETUP.md
database/README.md
```

## ❌ 绝对不能提交的文件

### 敏感信息
```
.env
.env.*
*.pem
*.key
secrets/
```

### 数据库备份
```
*.dump
*.sql.dump
*-backup.sql
*-dump.sql
test-data.sql  # 除非是脱敏示例
local_*.sql
dev_*.sql
```

### 构建和临时
```
node_modules/
dist/
build/
*.log
uploads/
*.tmp
```

### IDE 文件
```
.vscode/  # 除了 extensions.json
.idea/
.cursor/
```

### 私有文档
```
private-docs/
*.规划*.md
*.方案*.md
```

## 🚀 常用命令

### 检查敏感文件
```bash
# 检查是否有 .env 被跟踪
git ls-files | grep "\.env$"

# 检查是否有备份 SQL
git ls-files | grep -E "backup|dump|test.*\.sql$"
```

### 从跟踪中移除（保留本地）
```bash
git rm --cached <file>
git commit -m "chore: 移除敏感文件"
```

### 检查 .gitignore 是否生效
```bash
git status --ignored
```

