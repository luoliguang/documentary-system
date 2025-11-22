@echo off
setlocal enabledelayedexpansion

REM 项目大扫除脚本 (Windows)
REM 用法: clean-project.bat [--dry-run|--force]

set DRY_RUN=false
set FORCE=false

REM 解析参数
if "%1"=="--dry-run" set DRY_RUN=true
if "%1"=="--force" set FORCE=true

if "%DRY_RUN%"=="false" if "%FORCE%"=="false" (
    echo.
    echo Usage: %0 [--dry-run^|--force]
    echo   --dry-run: Preview files to delete ^(no actual deletion^)
    echo   --force:   Actually delete files
    echo.
    pause
    exit /b 1
)

set DELETED_COUNT=0

echo Scanning for junk files...
echo.

REM 1. Delete junk MD files
echo Scanning junk MD files...
for /r %%f in (*.md) do (
    set "file=%%f"
    set "basename=%%~nxf"
    set "skip=0"
    
    REM 白名单检查
    if "!basename!"=="README.md" set skip=1
    if "!basename!"=="ARCHITECTURE.md" set skip=1
    if "!basename!"=="GOD.md" set skip=1
    if "!basename!"=="CURSOR_RULES.md" set skip=1
    if "!basename!"=="SETUP.md" set skip=1
    
    REM 迁移文件：数字开头的保留
    echo !basename! | findstr /r "^[0-9][0-9]*_.*\.sql$" >nul && set skip=1
    
    if !skip!==0 (
        echo !basename! | findstr /i "TEMP TODO PLAN NEW DRAFT v2 backup copy EXPLAIN NOTE _TEMP _TODO _PLAN _NEW _DRAFT _v2 _backup _copy" >nul
        if !errorlevel!==0 (
            echo   [DELETE] !file!
            if "%FORCE%"=="true" (
                del /f /q "!file!" >nul 2>&1
                if !errorlevel!==0 set /a DELETED_COUNT+=1
            )
        )
    )
)

REM 2. Delete test/script junk
echo Scanning test/script junk...

REM __tests__ 下非 *.test.ts 的文件
if exist "__tests__" (
    for /r "__tests__" %%f in (*) do (
        set "file=%%f"
        echo !file! | findstr /i "\.test\.ts$" >nul
        if !errorlevel!==1 (
            echo   [DELETE] !file!
            if "%FORCE%"=="true" (
                del /f /q "!file!" >nul 2>&1
                if !errorlevel!==0 set /a DELETED_COUNT+=1
            )
        )
    )
)

REM scripts/ 下带 temp/old/backup/test/draft 的文件
if exist "scripts" (
    for /r "scripts" %%f in (*) do (
        set "file=%%f"
        set "basename=%%~nxf"
        echo !basename! | findstr /i "temp old backup test draft TEMP OLD BACKUP TEST DRAFT" >nul
        if !errorlevel!==0 (
            echo   [DELETE] !file!
            if "%FORCE%"=="true" (
                del /f /q "!file!" >nul 2>&1
                if !errorlevel!==0 set /a DELETED_COUNT+=1
            )
        )
    )
)

REM 根目录下 test-*.js、demo-*.ts、tmp-*.sql
for %%f in (test-*.js demo-*.ts tmp-*.sql) do (
    if exist "%%f" (
        echo   🗑️  %%f
        if "%FORCE%"=="true" (
            del /f /q "%%f" >nul 2>&1
            if !errorlevel!==0 set /a DELETED_COUNT+=1
        )
    )
)

REM 3. Delete migration drafts
echo Scanning migration drafts...
if exist "database\migrations" (
    for %%f in (database\migrations\*.sql) do (
        set "file=%%f"
        set "basename=%%~nxf"
        set "skip=0"
        
        REM 白名单：数字开头的保留
        echo !basename! | findstr /r "^[0-9][0-9]*_.*\.sql$" >nul && set skip=1
        
        if !skip!==0 (
            echo !basename! | findstr /i "draft temp old backup copy DRAFT TEMP OLD BACKUP COPY" >nul
            if !errorlevel!==0 (
                echo   [DELETE] !file!
                if "%FORCE%"=="true" (
                    del /f /q "!file!" >nul 2>&1
                    if !errorlevel!==0 set /a DELETED_COUNT+=1
                )
            )
        )
    )
)

echo.
if %DELETED_COUNT%==0 (
    echo No junk files found!
    echo.
    pause
    exit /b 0
)

if "%DRY_RUN%"=="true" (
    echo.
    echo DRY-RUN mode: No files were actually deleted
    echo    To actually delete, run: %0 --force
    echo.
    pause
    exit /b 0
)

if "%FORCE%"=="true" (
    echo.
    echo WARNING: About to delete the above files...
    set /p confirm=Confirm deletion? (y/N): 
    if /i not "!confirm!"=="y" (
        echo Cancelled
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Cleanup complete! Deleted %DELETED_COUNT% junk files
    echo.
    pause
)

