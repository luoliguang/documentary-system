# 将 PostgreSQL 添加到 PATH 的方法

## 问题

PostgreSQL 已安装，但 PowerShell 找不到 `psql` 命令，因为 PostgreSQL 的 `bin` 目录没有添加到系统 PATH 环境变量。

## 解决方法

### 方法一：临时添加到当前 PowerShell 会话

在 PowerShell 中运行（替换路径为您的实际安装路径）：

```powershell
# 假设 PostgreSQL 安装在默认位置（根据您的版本调整）
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"
# 或者
$env:Path += ";C:\Program Files\PostgreSQL\15\bin"
# 或者
$env:Path += ";C:\Program Files\PostgreSQL\14\bin"

# 验证
Get-Command psql
```

### 方法二：永久添加到系统 PATH（推荐）

#### 使用图形界面：

1. 右键点击"此电脑"或"我的电脑" → 属性
2. 点击"高级系统设置"
3. 点击"环境变量"
4. 在"系统变量"区域找到 `Path`，点击"编辑"
5. 点击"新建"
6. 添加 PostgreSQL 的 bin 目录，例如：
   - `C:\Program Files\PostgreSQL\16\bin`
   - `C:\Program Files\PostgreSQL\15\bin`
   - `C:\Program Files\PostgreSQL\14\bin`
7. 点击"确定"保存所有对话框
8. **重新打开 PowerShell 窗口**（环境变量更改需要重启终端）

#### 使用 PowerShell（需要管理员权限）：

```powershell
# 以管理员身份运行 PowerShell，然后执行：

$pgPath = "C:\Program Files\PostgreSQL\16\bin"  # 替换为您的实际路径

# 检查是否已存在
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($currentPath -notlike "*$pgPath*") {
    [Environment]::SetEnvironmentVariable('Path', $currentPath + ";$pgPath", 'Machine')
    Write-Host "已添加到系统 PATH" -ForegroundColor Green
} else {
    Write-Host "PATH 中已存在" -ForegroundColor Yellow
}

# 刷新当前会话
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine')
```

### 方法三：查找 PostgreSQL 安装位置

如果您不确定 PostgreSQL 安装在哪里，可以运行以下命令查找：

```powershell
# 方法1: 检查常见安装路径
Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue
Get-ChildItem "C:\Program Files (x86)\PostgreSQL" -Directory -ErrorAction SilentlyContinue

# 方法2: 搜索 psql.exe
Get-ChildItem -Path "C:\" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 FullName

# 方法3: 检查服务
Get-Service | Where-Object { $_.DisplayName -like '*PostgreSQL*' }
```

## 验证

添加后，**重新打开 PowerShell**，然后运行：

```powershell
Get-Command psql
psql --version
```

如果成功，应该会显示 psql 的路径和版本信息。

## 使用修复后的初始化脚本

一旦 PostgreSQL 添加到 PATH 或脚本找到安装位置，您就可以运行：

```powershell
cd database
.\init-db.ps1
```

脚本会自动检测 PostgreSQL 的安装位置，即使不在 PATH 中也能工作。

