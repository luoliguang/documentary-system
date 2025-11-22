# 运行客户公司迁移脚本
# 使用方法: .\run-company-migration.ps1

$ErrorActionPreference = "Stop"

Write-Host "开始运行客户公司迁移..." -ForegroundColor Green

# 查找 PostgreSQL 工具（psql）
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

# 查找 psql
$psqlPath = Find-PostgreSQLTool "psql"

if (-not $psqlPath) {
    Write-Host "错误: 未找到 PostgreSQL 工具（psql）" -ForegroundColor Red
    Write-Host ""
    Write-Host "解决方案:" -ForegroundColor Yellow
    Write-Host "1. 确保已安装 PostgreSQL" -ForegroundColor Yellow
    Write-Host "2. 将 PostgreSQL 的 bin 目录添加到系统 PATH 环境变量" -ForegroundColor Yellow
    Write-Host "3. 或者手动指定 psql 的完整路径" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "找到 psql: $psqlPath" -ForegroundColor Cyan
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
    
    $DB_HOST = if ($envVars["DB_HOST"]) { $envVars["DB_HOST"] } else { if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" } }
    $DB_PORT = if ($envVars["DB_PORT"]) { $envVars["DB_PORT"] } else { if ($env:DB_PORT) { $env:DB_PORT } else { "5432" } }
    $DB_NAME = if ($envVars["DB_NAME"]) { $envVars["DB_NAME"] } else { if ($env:DB_NAME) { $env:DB_NAME } else { "fangdu_db" } }
    $DB_USER = if ($envVars["DB_USER"]) { $envVars["DB_USER"] } else { if ($env:DB_USER) { $env:DB_USER } else { "postgres" } }
    $DB_PASSWORD = if ($envVars["DB_PASSWORD"]) { $envVars["DB_PASSWORD"] } else { if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" } }
} else {
    Write-Host "警告: 未找到 .env 文件，使用环境变量或默认配置" -ForegroundColor Yellow
    $DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
    $DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
    $DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "fangdu_db" }
    $DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
    $DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }
}

Write-Host "数据库配置:" -ForegroundColor Yellow
Write-Host "  主机: $DB_HOST"
Write-Host "  端口: $DB_PORT"
Write-Host "  数据库: $DB_NAME"
Write-Host "  用户: $DB_USER"
Write-Host ""

# 设置环境变量
$env:PGPASSWORD = $DB_PASSWORD
$env:PGUSER = $DB_USER
$env:PGHOST = $DB_HOST
$env:PGPORT = $DB_PORT
$env:PGDATABASE = $DB_NAME

# 设置客户端编码为 UTF-8
$env:PGCLIENTENCODING = "UTF8"

# 步骤1：创建表结构
Write-Host "步骤1：创建 customer_companies 表和添加字段..." -ForegroundColor Yellow
$migration1Path = Join-Path $PSScriptRoot "migrations\015_add_customer_companies.sql"
if (-not (Test-Path $migration1Path)) {
    Write-Host "错误: 迁移脚本不存在: $migration1Path" -ForegroundColor Red
    exit 1
}
& $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migration1Path
if ($LASTEXITCODE -ne 0) {
    Write-Host "步骤1失败！" -ForegroundColor Red
    exit 1
}

# 步骤2：迁移现有数据
Write-Host "步骤2：迁移现有数据到新结构..." -ForegroundColor Yellow
$migration2Path = Join-Path $PSScriptRoot "migrations\016_migrate_existing_data_to_companies.sql"
if (-not (Test-Path $migration2Path)) {
    Write-Host "错误: 迁移脚本不存在: $migration2Path" -ForegroundColor Red
    exit 1
}
& $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migration2Path
if ($LASTEXITCODE -ne 0) {
    Write-Host "步骤2失败！" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "迁移完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "请验证数据是否正确迁移。" -ForegroundColor Cyan

# 清除密码环境变量
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

