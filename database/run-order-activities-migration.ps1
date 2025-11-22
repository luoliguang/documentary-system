# Order Activities Migration Script
# This script runs the order activities table migration and data backfill
# Usage: .\run-order-activities-migration.ps1

param(
    [string]$DB_HOST,
    [string]$DB_PORT = "5432",
    [string]$DB_USER,
    [string]$DB_NAME,
    [SecureString]$DB_PASSWORD
)

# Function to find PostgreSQL tool
function Find-PostgreSQLTool {
    param([string]$ToolName)
    
    # Check if tool is in PATH
    $tool = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($tool) {
        return $tool.Path
    }
    
    # Common installation paths
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe",
        "C:\Program Files (x86)\PostgreSQL\*\bin\$ToolName.exe",
        "$env:ProgramFiles\PostgreSQL\*\bin\$ToolName.exe",
        "$env:ProgramFiles(x86)\PostgreSQL\*\bin\$ToolName.exe"
    )
    
    foreach ($path in $commonPaths) {
        $found = Get-ChildItem -Path $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            return $found.FullName
        }
    }
    
    return $null
}

# Function to read .env file
function Read-EnvFile {
    param([string]$EnvPath)
    
    if (-not (Test-Path $EnvPath)) {
        return @{}
    }
    
    $envVars = @{}
    Get-Content $EnvPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+?)\s*$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            if ($value -match '^["''](.+)["'']$') {
                $value = $matches[1]
            }
            $envVars[$key] = $value
        }
    }
    return $envVars
}

# Step 1: Find psql
$psqlPath = Find-PostgreSQLTool "psql"
if (-not $psqlPath) {
    Write-Host "Error: PostgreSQL tool (psql) not found" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL is installed and psql is in your PATH, or install PostgreSQL from:" -ForegroundColor Yellow
    Write-Host "  https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}
Write-Host "Found PostgreSQL tool: $psqlPath" -ForegroundColor Green

# Step 2: Read database configuration
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendEnvPath = Join-Path $scriptDir "..\backend\.env"

# Try to read from backend/.env
$envVars = @{}
if (Test-Path $backendEnvPath) {
    Write-Host "Reading database configuration from: $backendEnvPath" -ForegroundColor Cyan
    $envVars = Read-EnvFile $backendEnvPath
} else {
    Write-Host "Warning: .env file not found at $backendEnvPath" -ForegroundColor Yellow
    Write-Host "Trying to read from environment variables..." -ForegroundColor Yellow
}

# Get database connection details (priority: script params > .env file > environment variables > prompt)
if (-not $DB_HOST) {
    $DB_HOST = $envVars.DB_HOST
    if (-not $DB_HOST) {
        $DB_HOST = $env:DB_HOST
    }
    if (-not $DB_HOST) {
        $DB_HOST = Read-Host "Enter database host (default: localhost)"
        if ([string]::IsNullOrWhiteSpace($DB_HOST)) {
            $DB_HOST = "localhost"
        }
    }
}

if (-not $DB_PORT) {
    $DB_PORT = $envVars.DB_PORT
    if (-not $DB_PORT) {
        $DB_PORT = $env:DB_PORT
    }
    if (-not $DB_PORT) {
        $DB_PORT = Read-Host "Enter database port (default: 5432)"
        if ([string]::IsNullOrWhiteSpace($DB_PORT)) {
            $DB_PORT = "5432"
        }
    }
}

if (-not $DB_USER) {
    $DB_USER = $envVars.DB_USER
    if (-not $DB_USER) {
        $DB_USER = $env:DB_USER
    }
    if (-not $DB_USER) {
        $DB_USER = Read-Host "Enter database user (default: postgres)"
        if ([string]::IsNullOrWhiteSpace($DB_USER)) {
            $DB_USER = "postgres"
        }
    }
}

if (-not $DB_NAME) {
    $DB_NAME = $envVars.DB_NAME
    if (-not $DB_NAME) {
        $DB_NAME = $env:DB_NAME
    }
    if (-not $DB_NAME) {
        $DB_NAME = Read-Host "Enter database name"
        if ([string]::IsNullOrWhiteSpace($DB_NAME)) {
            Write-Host "Error: Database name is required" -ForegroundColor Red
            exit 1
        }
    }
}

# Handle password: convert SecureString to plain string if needed
$passwordPlainText = $null

if ($DB_PASSWORD) {
    # If parameter is provided as SecureString, convert it
    if ($DB_PASSWORD -is [SecureString]) {
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD)
        $passwordPlainText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    } else {
        $passwordPlainText = $DB_PASSWORD
    }
} else {
    # Try to get password from .env file or environment variable
    $passwordPlainText = $envVars.DB_PASSWORD
    if (-not $passwordPlainText) {
        $passwordPlainText = $env:DB_PASSWORD
    }
    if (-not $passwordPlainText) {
        # Prompt for password
        $securePassword = Read-Host "Enter database password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $passwordPlainText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }
}

# Set environment variable for psql
$env:PGPASSWORD = $passwordPlainText
$env:PGCLIENTENCODING = "UTF8"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Database Migration Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Host: $DB_HOST" -ForegroundColor White
Write-Host "Port: $DB_PORT" -ForegroundColor White
Write-Host "User: $DB_USER" -ForegroundColor White
Write-Host "Database: $DB_NAME" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 3: Find and run migrations
$migrationDir = Join-Path $scriptDir "migrations"

# Find all order activities related migration files
# Pattern: files starting with numbers and containing "order_activities" or "order-activities" in name
$migrationFiles = Get-ChildItem -Path $migrationDir -Filter "*.sql" | 
    Where-Object { 
        $_.Name -match '^\d+.*order[_-]activit' -or 
        $_.Name -match '^\d+.*activit.*order'
    } | 
    Sort-Object { [int]($_.Name -replace '^(\d+).*', '$1') }

# If no specific pattern found, allow user to specify files or use all numbered migrations
if ($migrationFiles.Count -eq 0) {
    Write-Host "No migration files found matching pattern. Looking for all numbered migration files..." -ForegroundColor Yellow
    $migrationFiles = Get-ChildItem -Path $migrationDir -Filter "*.sql" | 
        Where-Object { $_.Name -match '^\d+_' } | 
        Sort-Object { [int]($_.Name -replace '^(\d+).*', '$1') }
}

if ($migrationFiles.Count -eq 0) {
    Write-Host "Error: No migration files found in $migrationDir" -ForegroundColor Red
    exit 1
}

Write-Host "`nFound $($migrationFiles.Count) migration file(s) to execute:" -ForegroundColor Cyan
foreach ($file in $migrationFiles) {
    Write-Host "  - $($file.Name)" -ForegroundColor White
}
Write-Host ""

# Execute migrations in order
$stepNumber = 1
foreach ($migrationFile in $migrationFiles) {
    $migrationPath = $migrationFile.FullName
    $fileName = $migrationFile.Name
    
    Write-Host "Step ${stepNumber}: Executing $fileName..." -ForegroundColor Yellow
    & $psqlPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migrationPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Step $stepNumber failed! Migration: $fileName" -ForegroundColor Red
        exit 1
    }
    Write-Host "Step $stepNumber completed successfully!" -ForegroundColor Green
    $stepNumber++
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Migration completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Clean up
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

