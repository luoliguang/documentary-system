# 系统配置迁移执行脚本 (PowerShell)
# 使用方法: .\database\run-config-migration.ps1

$ErrorActionPreference = "Stop"

Write-Host "开始执行系统配置数据库迁移..." -ForegroundColor Green

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
    Write-Host "   例如: C:\Program Files\PostgreSQL\16\bin" -ForegroundColor Yellow
    Write-Host "3. 或者使用 Node.js 脚本执行迁移（推荐）:" -ForegroundColor Yellow
    Write-Host "   node scripts/run-config-migration.js" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "找到 PostgreSQL 工具: $psqlPath" -ForegroundColor Green
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
    $DB_PASSWORD = "postgres"
}

Write-Host "数据库配置:" -ForegroundColor Yellow
Write-Host "  主机: $DB_HOST"
Write-Host "  端口: $DB_PORT"
Write-Host "  数据库: $DB_NAME"
Write-Host "  用户: $DB_USER"
Write-Host ""

# 设置环境变量
$env:PGPASSWORD = $DB_PASSWORD

# 执行迁移脚本
Write-Host "执行迁移脚本..." -ForegroundColor Green
$migrationPath = Join-Path $PSScriptRoot "migrations\003_add_account_field.sql"

if (-not (Test-Path $migrationPath)) {
    Write-Host "错误: 迁移脚本不存在: $migrationPath" -ForegroundColor Red
    exit 1
}

& $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migrationPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "迁移执行成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # 验证迁移结果
    Write-Host "验证迁移结果..." -ForegroundColor Green
    $verifyQuery = @"
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'system_configs'
    ) THEN '✅ system_configs 表已创建' ELSE '❌ system_configs 表未创建' END as table_status;
"@
    
    $verifyResult = & $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $verifyQuery 2>&1
    Write-Host $verifyResult
    
} else {
    Write-Host ""
    Write-Host "迁移执行失败！" -ForegroundColor Red
    Write-Host "请检查错误信息并重试" -ForegroundColor Yellow
    exit 1
}

# 清除密码环境变量
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "完成！" -ForegroundColor Green

