# 数据库初始化故障排查

## 常见问题

### 1. psql 命令未找到

**错误信息:**
```
The term 'psql' is not recognized as a name of a cmdlet, function, script file, or executable program.
```

**解决方案:**

#### 方法一：添加到 PATH 环境变量（推荐）

1. 找到 PostgreSQL 安装目录，通常在：
   - `C:\Program Files\PostgreSQL\16\bin`
   - `C:\Program Files\PostgreSQL\15\bin`
   - `C:\Program Files (x86)\PostgreSQL\16\bin`

2. 添加到系统 PATH：
   - 右键"此电脑" → 属性 → 高级系统设置 → 环境变量
   - 在"系统变量"中找到 `Path`，点击编辑
   - 点击"新建"，添加 PostgreSQL 的 bin 目录路径
   - 点击"确定"保存

3. 重新打开 PowerShell 窗口

#### 方法二：使用修复后的脚本

现在脚本会自动检测常见的 PostgreSQL 安装路径，无需手动添加 PATH。

#### 方法三：手动指定路径

如果 PostgreSQL 安装在其他位置，可以修改脚本中的 `$commonPaths` 数组，添加您的安装路径。

### 2. 数据库连接失败

**错误信息:**
```
psql: FATAL: password authentication failed for user "postgres"
```

**解决方案:**

1. 检查 `.env` 文件中的数据库密码是否正确：
   ```env
   DB_PASSWORD=your_actual_password
   ```

2. 如果忘记密码，可以重置：
   ```powershell
   # Windows
   net stop postgresql-x64-16
   net start postgresql-x64-16
   # 然后修改 pg_hba.conf，将认证方式改为 trust（临时）
   ```

3. 或者在 PostgreSQL 安装目录下找到 `pg_hba.conf`，检查认证配置。

### 3. 数据库已存在错误

**错误信息:**
```
ERROR: database "fangdu_db" already exists
```

**解决方案:**

这是正常的，脚本会自动跳过。如果确实需要重新创建，先删除数据库：
```powershell
psql -U postgres -c "DROP DATABASE fangdu_db;"
```

### 4. 权限不足

**错误信息:**
```
ERROR: permission denied to create database
```

**解决方案:**

1. 确保使用 postgres 用户（超级用户）
2. 或者创建一个有权限的用户：
   ```sql
   CREATE USER your_user WITH PASSWORD 'password';
   ALTER USER your_user CREATEDB;
   ```

### 5. 端口被占用或 PostgreSQL 未运行

**错误信息:**
```
could not connect to server: Connection refused
```

**解决方案:**

1. 检查 PostgreSQL 服务是否运行：
   ```powershell
   # Windows
   Get-Service postgresql*
   # 如果未运行，启动服务
   Start-Service postgresql-x64-16
   ```

2. 检查端口是否被占用：
   ```powershell
   netstat -ano | findstr :5432
   ```

3. 检查 `.env` 文件中的端口配置是否正确。

### 6. 编码问题（中文乱码）

**解决方案:**

脚本已修复，使用 UTF-8 编码。如果仍有问题：

1. PowerShell 窗口设置：
   ```powershell
   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
   ```

2. 或者在脚本开头添加：
   ```powershell
   $OutputEncoding = [System.Text.Encoding]::UTF8
   ```

### 7. .env 文件未找到

**错误信息:**
```
警告: 未找到 .env 文件，使用默认配置
```

**解决方案:**

1. 创建 `backend/.env` 文件（复制 `backend/.env.example`）
2. 根据实际情况修改配置：
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=fangdu_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

## 验证安装

运行以下命令验证 PostgreSQL 是否正确安装：

```powershell
# 检查 psql 是否可用
Get-Command psql

# 检查 PostgreSQL 版本
psql --version

# 测试连接
psql -U postgres -c "SELECT version();"
```

## 获取帮助

如果以上方法都无法解决问题：

1. 检查 PostgreSQL 安装日志
2. 查看 PostgreSQL 服务日志
3. 确认 PostgreSQL 已正确安装
4. 检查防火墙设置

## 手动初始化

如果脚本无法运行，可以手动执行 SQL 文件：

```powershell
# 1. 创建数据库
psql -U postgres -c "CREATE DATABASE fangdu_db;"

# 2. 导入结构
psql -U postgres -d fangdu_db -f database/schema.sql

# 3. 导入初始数据（可选）
psql -U postgres -d fangdu_db -f database/init.sql
```

