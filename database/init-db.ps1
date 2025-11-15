# 跟单系统数据库初始化脚本 (PowerShell)
# 使用方法: .\init-db.ps1

$ErrorActionPreference = "Stop"

Write-Host "开始初始化数据库..." -ForegroundColor Green

# 查找 PostgreSQL 工具（psql, createdb）
function Find-PostgreSQLTool {
    param([string]$ToolName)
    
    # 首先检查是否在 PATH 中
    $tool = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($tool) {
        return $tool.Path
    }
    
    # 尝试常见的 PostgreSQL 安装路径
    $commonPaths = @(
        "D:\Data\PostgreSql\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\16\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\15\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\14\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\13\bin\$ToolName.exe",
        "C:\Program Files\PostgreSQL\12\bin\$ToolName.exe",
        "C:\Program Files (x86)\PostgreSQL\16\bin\$ToolName.exe",
        "C:\Program Files (x86)\PostgreSQL\15\bin\$ToolName.exe",
        "C:\Program Files (x86)\PostgreSQL\14\bin\$ToolName.exe",
        "C:\Program Files (x86)\PostgreSQL\13\bin\$ToolName.exe",
        "C:\Program Files (x86)\PostgreSQL\12\bin\$ToolName.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    return $null
}

# 查找 psql 和 createdb
$psqlPath = Find-PostgreSQLTool "psql"
$createdbPath = Find-PostgreSQLTool "createdb"

if (-not $psqlPath -or -not $createdbPath) {
    Write-Host "错误: 未找到 PostgreSQL 工具（psql 或 createdb）" -ForegroundColor Red
    Write-Host ""
    Write-Host "解决方案:" -ForegroundColor Yellow
    Write-Host "1. 确保已安装 PostgreSQL" -ForegroundColor Yellow
    Write-Host "2. 将 PostgreSQL 的 bin 目录添加到系统 PATH 环境变量" -ForegroundColor Yellow
    Write-Host "   例如: C:\Program Files\PostgreSQL\16\bin" -ForegroundColor Yellow
    Write-Host "3. 或者修改此脚本，手动指定 PostgreSQL 的安装路径" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "您可以通过以下命令检查 PostgreSQL 是否在 PATH 中:" -ForegroundColor Cyan
    Write-Host "  Get-Command psql" -ForegroundColor Cyan
    exit 1
}

Write-Host "找到 PostgreSQL 工具:" -ForegroundColor Green
Write-Host "  psql: $psqlPath" -ForegroundColor Gray
Write-Host "  createdb: $createdbPath" -ForegroundColor Gray
Write-Host ""

# 读取 .env 文件中的数据库配置
$envPath = Join-Path $PSScriptRoot "..\backend\.env"

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    $envVars = @{}
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
    
    $DB_HOST = if ($envVars["DB_HOST"]) { $envVars["DB_HOST"] } else { "localhost" }
    $DB_PORT = if ($envVars["DB_PORT"]) { $envVars["DB_PORT"] } else { "5432" }
    $DB_NAME = if ($envVars["DB_NAME"]) { $envVars["DB_NAME"] } else { "fangdu_db" }
    $DB_USER = if ($envVars["DB_USER"]) { $envVars["DB_USER"] } else { "postgres" }
    $DB_PASSWORD = if ($envVars["DB_PASSWORD"]) { $envVars["DB_PASSWORD"] } else { "postgres" }
} else {
    Write-Host "警告: 未找到 .env 文件，使用默认配置" -ForegroundColor Yellow
    $DB_HOST = "localhost"
    $DB_PORT = "5432"
    $DB_NAME = "fangdu_db"
    $DB_USER = "postgres"
    $DB_PASSWORD = "614614.."
}

Write-Host "数据库配置:" -ForegroundColor Yellow
Write-Host "  主机: $DB_HOST"
Write-Host "  端口: $DB_PORT"
Write-Host "  数据库: $DB_NAME"
Write-Host "  用户: $DB_USER"
Write-Host ""

# 设置环境变量
$env:PGPASSWORD = $DB_PASSWORD

# 检查数据库是否存在
Write-Host "检查数据库是否存在..." -ForegroundColor Green
$dbExists = & $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt 2>&1 | Select-String -Pattern "\b$DB_NAME\b"

if (-not $dbExists) {
    Write-Host "数据库不存在，正在创建..." -ForegroundColor Yellow
    $createResult = & $createdbPath -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>&1
    
    if ($LASTEXITCODE -eq 0 -or $createResult -match "already exists") {
        Write-Host "数据库创建成功！" -ForegroundColor Green
    } else {
        Write-Host "数据库创建失败！请检查数据库连接信息" -ForegroundColor Red
        Write-Host "错误信息: $createResult" -ForegroundColor Red
        Write-Host "提示: 如果密码错误，请检查 .env 文件中的 DB_PASSWORD 配置" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "数据库已存在，跳过创建" -ForegroundColor Green
}

# 导入数据库结构
Write-Host "导入数据库结构..." -ForegroundColor Green
$schemaPath = Join-Path $PSScriptRoot "schema.sql"
& $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $schemaPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "数据库结构导入成功！" -ForegroundColor Green
} else {
    Write-Host "数据库结构导入失败！" -ForegroundColor Red
    exit 1
}

# 导入初始数据（如果存在）
$initPath = Join-Path $PSScriptRoot "init.sql"
if (Test-Path $initPath) {
    Write-Host "导入初始数据..." -ForegroundColor Green
    & $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $initPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "初始数据导入成功！" -ForegroundColor Green
    } else {
        Write-Host "初始数据导入失败（可能已存在），继续..." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "数据库初始化完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "默认账号信息:"
Write-Host "  管理员: admin / admin123"
Write-Host "  测试客户: customer001 / admin123"
Write-Host ""

# 清除密码环境变量
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

