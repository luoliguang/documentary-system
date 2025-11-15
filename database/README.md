# 数据库初始化说明

## 方法一：使用自动化脚本（推荐）

### Windows PowerShell
```powershell
cd database
.\init-db.ps1
```

### Windows CMD
```cmd
cd database
init-db.bat
```

### Linux/macOS
```bash
cd database
chmod +x init-db.sh
./init-db.sh
```

## 方法二：手动初始化

### 1. 创建数据库

```bash
# Windows PowerShell/CMD
createdb -U postgres fangdu_db

# Linux/macOS
createdb -U postgres fangdu_db

# 或者使用 psql
psql -U postgres
CREATE DATABASE fangdu_db;
\q
```

### 2. 导入数据库结构

```bash
# Windows PowerShell/CMD
psql -U postgres -d fangdu_db -f schema.sql

# Linux/macOS
psql -U postgres -d fangdu_db -f schema.sql
```

### 3. 导入初始数据（可选）

```bash
# Windows PowerShell/CMD
psql -U postgres -d fangdu_db -f init.sql

# Linux/macOS
psql -U postgres -d fangdu_db -f init.sql
```

## 数据库配置

确保 `backend/.env` 文件中的数据库配置正确：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fangdu_db
DB_USER=postgres
DB_PASSWORD=your_password_here
```

## 默认账号

初始化后，系统会创建以下默认账号：

- **管理员账号**
  - 用户名: `admin`
  - 密码: `admin123`

- **测试客户账号**
  - 用户名: `customer001`
  - 密码: `admin123`
  - 客户编号: `CUST001`

**⚠️ 重要提示：生产环境请务必修改默认密码！**

## 故障排查

### 问题：找不到 createdb 或 psql 命令

**解决方案：**
- 确保 PostgreSQL 已安装并添加到系统 PATH
- Windows: 安装 PostgreSQL 时选择"添加到 PATH"
- Linux: `sudo apt-get install postgresql-client` (Ubuntu/Debian)
- macOS: `brew install postgresql`

### 问题：认证失败

**解决方案：**
- 检查 `pg_hba.conf` 文件配置
- 确保 postgres 用户密码正确
- 使用 `set PGPASSWORD=your_password` (Windows) 或 `export PGPASSWORD=your_password` (Linux/macOS)

### 问题：数据库已存在

**解决方案：**
- 脚本会自动跳过创建步骤
- 如需重新创建，先删除现有数据库：`dropdb -U postgres fangdu_db`

## 重置数据库

如果需要重置数据库：

```bash
# 删除数据库
dropdb -U postgres fangdu_db

# 重新初始化
./init-db.sh  # Linux/macOS
# 或
.\init-db.ps1  # Windows PowerShell
```

