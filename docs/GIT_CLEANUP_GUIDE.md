# Git 清理指南 - 移除已提交的敏感文件

## 📋 必须提交的文档清单

以下文档**必须提交**到 Git 仓库：

### 架构文档
- ✅ `ARCHITECTURE.md` - 项目总纲架构文档
- ✅ `docs/adr/*.md` - 架构决策记录（ADR）
- ✅ `docs/diagrams/*.png` - C4 架构图
- ✅ `docs/architecture-roadmap.md` - 架构演进路线图

### 数据库文档
- ✅ `database/schema.sql` - 数据库结构定义（必须提交）
- ✅ `database/init.sql` - 初始化脚本（必须提交）
- ✅ `database/migrations/*.sql` - 数据库迁移脚本（必须提交）
- ✅ `docs/database/*.sql` - 文档性 SQL 脚本（必须提交）
- ✅ `database/test-data-example.sql` - 脱敏测试数据示例（可提交）

### 项目文档
- ✅ `README.md` - 项目说明
- ✅ `SETUP.md` - 安装配置指南
- ✅ `database/README.md` - 数据库说明文档

---

## 🚫 必须忽略的文件类型

以下文件**绝对不能提交**：

### 敏感信息
- ❌ `.env` / `.env.*` - 环境变量文件（包含密钥、密码）
- ❌ `*.pem` / `*.key` / `*.cert` - 证书和密钥文件
- ❌ `secrets/` - 密钥目录

### 数据库备份和临时文件
- ❌ `*.dump` / `*.sql.dump` - 数据库备份文件
- ❌ `*-backup.sql` / `*-dump.sql` - 备份 SQL 文件
- ❌ `test-data.sql` / `test_*.sql` - 测试数据文件（除非是脱敏示例）
- ❌ `local_*.sql` / `dev_*.sql` - 本地开发数据库文件
- ❌ `dump_*.sql` / `backup_*.sql` - 任何备份文件

### 构建和临时文件
- ❌ `node_modules/` - 依赖目录
- ❌ `dist/` / `build/` - 构建输出
- ❌ `*.log` - 日志文件
- ❌ `uploads/` - 上传文件目录
- ❌ `*.tmp` / `*.temp` - 临时文件

### IDE 和编辑器文件
- ❌ `.vscode/` (除了 `extensions.json`)
- ❌ `.idea/` - IntelliJ IDEA
- ❌ `.cursor/` - Cursor AI 编辑器
- ❌ `*.sublime-project` / `*.sublime-workspace`

### 私有文档
- ❌ `private-docs/` - 私有规划文档
- ❌ `*.规划*.md` / `*.方案*.md` - 功能规划文档

---

## 🧹 Git 清理命令（按顺序执行）

### 步骤 1: 检查已提交的敏感文件

```bash
# 检查是否有 .env 文件被提交
git log --all --full-history --oneline -- "*.env" "backend/.env" "frontend/.env"

# 检查是否有数据库备份文件被提交
git log --all --full-history --oneline -- "*backup*.sql" "*dump*.sql" "*test*.sql"

# 检查当前工作区是否有敏感文件
git status --ignored | grep -E "\.env|backup|dump"
```

### 步骤 2: 从 Git 历史中移除敏感文件（使用 git filter-repo）

**⚠️ 警告：这些操作会重写 Git 历史，请先备份仓库！**

#### 方法 A: 使用 git filter-repo（推荐）

```bash
# 1. 安装 git-filter-repo（如果未安装）
# Windows (PowerShell):
pip install git-filter-repo

# 2. 备份当前分支
git branch backup-before-cleanup

# 3. 移除 .env 文件的所有历史记录
git filter-repo --path backend/.env --invert-paths --force
git filter-repo --path frontend/.env --invert-paths --force
git filter-repo --path .env --invert-paths --force

# 4. 移除数据库备份文件
git filter-repo --path-glob "*backup*.sql" --invert-paths --force
git filter-repo --path-glob "*dump*.sql" --invert-paths --force
git filter-repo --path-glob "dump_*.sql" --invert-paths --force
git filter-repo --path-glob "test-data.sql" --invert-paths --force

# 5. 移除日志文件
git filter-repo --path-glob "*.log" --invert-paths --force

# 6. 强制推送到远程（⚠️ 危险操作，确保团队已同步）
git push origin --force --all
git push origin --force --tags
```

#### 方法 B: 使用 BFG Repo-Cleaner（更快速）

```bash
# 1. 下载 BFG: https://rtyley.github.io/bfg-repo-cleaner/

# 2. 克隆镜像仓库（用于清理）
git clone --mirror https://github.com/your-org/your-repo.git

# 3. 清理敏感文件
java -jar bfg.jar --delete-files "*.env"
java -jar bfg.jar --delete-files "*backup*.sql"
java -jar bfg.jar --delete-files "*dump*.sql"

# 4. 清理并推送
cd your-repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push
```

#### 方法 C: 使用 git filter-branch（传统方法，较慢）

```bash
# 移除 .env 文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env frontend/.env .env" \
  --prune-empty --tag-name-filter cat -- --all

# 移除备份 SQL 文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch '*backup*.sql' '*dump*.sql'" \
  --prune-empty --tag-name-filter cat -- --all

# 清理引用
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 步骤 3: 从工作区移除敏感文件（但保留本地文件）

```bash
# 从 Git 跟踪中移除，但保留本地文件
git rm --cached backend/.env
git rm --cached frontend/.env
git rm --cached "*.backup.sql"
git rm --cached "*.dump.sql"

# 提交更改
git commit -m "chore: 移除敏感文件从 Git 跟踪"
```

### 步骤 4: 验证清理结果

```bash
# 检查是否还有敏感文件
git log --all --full-history --oneline -- "*.env"
git log --all --full-history --oneline -- "*backup*.sql"

# 检查 .gitignore 是否生效
git status --ignored
```

### 步骤 5: 更新远程仓库

```bash
# ⚠️ 如果使用了 filter-repo 或 filter-branch，需要强制推送
# 确保团队成员已同步，并通知他们重新克隆仓库

git push origin --force --all
git push origin --force --tags
```

---

## 📝 最佳实践

### 1. 添加新 ADR 文档

```bash
# 1. 在 docs/adr/ 目录下创建新 ADR
touch docs/adr/ADR-XXX-feature-name.md

# 2. 编写内容后，正常提交
git add docs/adr/ADR-XXX-feature-name.md
git commit -m "docs: 添加 ADR-XXX 架构决策记录"
git push
```

### 2. 添加架构图

```bash
# 1. 将 C4 图保存到 docs/diagrams/
# 例如：docs/diagrams/system-context.png

# 2. 提交
git add docs/diagrams/*.png
git commit -m "docs: 添加系统架构图"
git push
```

### 3. 更新 ARCHITECTURE.md

```bash
# 1. 编辑 ARCHITECTURE.md
# 2. 提交更新
git add ARCHITECTURE.md
git commit -m "docs: 更新架构文档 - [变更说明]"
git push
```

### 4. 添加数据库迁移脚本

```bash
# 1. 在 database/migrations/ 创建迁移文件
touch database/migrations/014_new_feature.sql

# 2. 编写迁移 SQL
# 3. 提交（迁移脚本必须提交）
git add database/migrations/014_new_feature.sql
git commit -m "feat: 添加数据库迁移 014 - [功能说明]"
git push
```

### 5. 创建测试数据示例（脱敏）

```bash
# 1. 创建脱敏的测试数据示例
touch database/test-data-example.sql

# 2. 确保数据已脱敏（无真实客户信息、密码等）
# 3. 提交
git add database/test-data-example.sql
git commit -m "docs: 添加脱敏测试数据示例"
git push
```

### 6. 私有规划文档处理

```bash
# 1. 将规划文档放到 private-docs/ 目录
mv "功能规划.md" private-docs/

# 2. private-docs/ 已在 .gitignore 中，不会被提交
# 3. 如需团队共享，使用其他方式（如内部文档系统）
```

---

## 🔒 安全检查清单

在推送代码前，请检查：

- [ ] 没有 `.env` 文件被提交
- [ ] 没有数据库备份文件（`*.dump`, `*backup*.sql`）
- [ ] 没有包含真实密码或密钥的文件
- [ ] 没有日志文件（`*.log`）
- [ ] 没有临时文件（`*.tmp`, `*.temp`）
- [ ] 私有文档在 `private-docs/` 目录
- [ ] `.gitignore` 已更新并生效

---

## 🆘 如果敏感信息已泄露

如果敏感信息（如密码、API 密钥）已经推送到公开仓库：

1. **立即更换所有泄露的密钥和密码**
2. **从 Git 历史中移除敏感文件**（使用上述清理命令）
3. **通知团队成员重新克隆仓库**
4. **检查是否有其他泄露渠道**（如 Issues、Pull Requests）

---

## 📚 参考资源

- [GitHub 文档：移除敏感数据](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [git-filter-repo 文档](https://github.com/newren/git-filter-repo)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

