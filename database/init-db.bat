@echo off
chcp 65001 >nul
REM 跟单系统数据库初始化脚本 (Windows Batch)
REM 使用方法: init-db.bat

setlocal enabledelayedexpansion

echo 开始初始化数据库...

REM 读取 .env 文件中的数据库配置
set ENV_FILE=..\backend\.env
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=fangdu_db
set DB_USER=postgres
set DB_PASSWORD=postgres

if exist %ENV_FILE% (
    echo 正在读取 .env 配置文件...
    for /f "usebackq tokens=1,2 delims==" %%a in ("%ENV_FILE%") do (
        set key=%%a
        set value=%%b
        if "!key!"=="DB_HOST" set DB_HOST=!value!
        if "!key!"=="DB_PORT" set DB_PORT=!value!
        if "!key!"=="DB_NAME" set DB_NAME=!value!
        if "!key!"=="DB_USER" set DB_USER=!value!
        if "!key!"=="DB_PASSWORD" set DB_PASSWORD=!value!
    )
) else (
    echo 警告: 未找到 .env 文件，使用默认配置
)

echo 数据库配置:
echo   主机: %DB_HOST%
echo   端口: %DB_PORT%
echo   数据库: %DB_NAME%
echo   用户: %DB_USER%
echo.

REM 设置环境变量
set PGPASSWORD=%DB_PASSWORD%

REM 检查数据库是否存在
echo 检查数据库是否存在...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -lqt 2>nul | findstr /C:"%DB_NAME%" >nul

if errorlevel 1 (
    echo 数据库不存在，正在创建...
    createdb -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME%
    if errorlevel 1 (
        echo 数据库创建失败！
        exit /b 1
    )
    echo 数据库创建成功！
) else (
    echo 数据库已存在，跳过创建
)

REM 导入数据库结构
echo 导入数据库结构...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f schema.sql

if errorlevel 1 (
    echo 数据库结构导入失败！
    exit /b 1
)
echo 数据库结构导入成功！

REM 导入初始数据（如果存在）
if exist init.sql (
    echo 导入初始数据...
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f init.sql
    if errorlevel 1 (
        echo 初始数据导入失败（可能已存在），继续...
    ) else (
        echo 初始数据导入成功！
    )
)

echo.
echo ========================================
echo 数据库初始化完成！
echo ========================================
echo.
echo 默认账号信息:
echo   管理员: admin / admin123
echo   测试客户: customer001 / admin123
echo.

REM 清除密码环境变量
set PGPASSWORD=

endlocal

