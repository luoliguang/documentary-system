# 查找 PostgreSQL 安装位置的脚本

Write-Host "正在查找 PostgreSQL 安装位置..." -ForegroundColor Green
Write-Host ""

$foundPaths = @()

# 方法1: 检查常见安装路径
$commonPaths = @(
    "C:\Program Files\PostgreSQL",
    "C:\Program Files (x86)\PostgreSQL"
)

foreach ($basePath in $commonPaths) {
    if (Test-Path $basePath) {
        $versions = Get-ChildItem $basePath -Directory | Where-Object { $_.Name -match '^\d+$' }
        foreach ($version in $versions) {
            $binPath = Join-Path $version.FullName "bin"
            if (Test-Path (Join-Path $binPath "psql.exe")) {
                Write-Host "找到 PostgreSQL: $binPath" -ForegroundColor Green
                $foundPaths += $binPath
            }
        }
    }
}

# 方法2: 检查环境变量
$pathEnv = $env:Path -split ';'
$pgInPath = $pathEnv | Where-Object { $_ -match 'postgres' -and $_ -match 'bin' }
if ($pgInPath) {
    Write-Host "在 PATH 中找到: $pgInPath" -ForegroundColor Cyan
}

# 方法3: 搜索注册表
Write-Host ""
Write-Host "正在检查注册表..." -ForegroundColor Yellow
$regPaths = @(
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

foreach ($regPath in $regPaths) {
    $items = Get-ItemProperty $regPath -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*PostgreSQL*' }
    foreach ($item in $items) {
        if ($item.InstallLocation) {
            $binPath = Join-Path $item.InstallLocation "bin"
            if (Test-Path (Join-Path $binPath "psql.exe")) {
                Write-Host "从注册表找到: $binPath" -ForegroundColor Green
                if ($foundPaths -notcontains $binPath) {
                    $foundPaths += $binPath
                }
            }
        }
    }
}

Write-Host ""
if ($foundPaths.Count -eq 0) {
    Write-Host "未找到 PostgreSQL 安装，请检查是否正确安装。" -ForegroundColor Red
    Write-Host ""
    Write-Host "您可以手动查找 PostgreSQL 安装目录：" -ForegroundColor Yellow
    Write-Host "  1. 打开 PostgreSQL 安装目录（通常在 C:\Program Files\PostgreSQL\XX\bin）" -ForegroundColor Yellow
    Write-Host "  2. 确认 psql.exe 文件存在" -ForegroundColor Yellow
    Write-Host "  3. 将 bin 目录添加到系统 PATH 环境变量" -ForegroundColor Yellow
} else {
    Write-Host "找到 $($foundPaths.Count) 个 PostgreSQL 安装：" -ForegroundColor Green
    foreach ($path in $foundPaths) {
        Write-Host "  - $path" -ForegroundColor Cyan
    }
    Write-Host ""
    
    $latestPath = $foundPaths | Sort-Object { [int]((Split-Path (Split-Path $_) -Leaf) -replace '\D', '') } -Descending | Select-Object -First 1
    
    Write-Host "建议使用的路径: $latestPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "要添加到当前会话的 PATH，运行：" -ForegroundColor Yellow
    Write-Host "  `$env:Path += `";$latestPath`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "要永久添加到系统 PATH，运行（需要管理员权限）：" -ForegroundColor Yellow
    Write-Host "  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'Machine') + `";$latestPath`", 'Machine')" -ForegroundColor Cyan
}

