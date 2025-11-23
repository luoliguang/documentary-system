@echo off
chcp 65001 >nul
echo 🚀 开始构建 Android APK...

echo 📦 步骤 1/4: 构建前端项目...
call npm run build
if errorlevel 1 (
    echo ❌ 构建失败！
    pause
    exit /b 1
)

echo 📋 步骤 2/4: 复制资源到 Android 项目...
call npx cap copy
if errorlevel 1 (
    echo ❌ 复制失败！
    pause
    exit /b 1
)

echo 🔄 步骤 3/4: 同步 Capacitor 插件...
call npx cap sync
if errorlevel 1 (
    echo ❌ 同步失败！
    pause
    exit /b 1
)

echo 🎯 步骤 4/4: 尝试打开 Android Studio...
echo.

call npx cap open android 2>nul
if errorlevel 1 (
    echo ⚠️  无法自动打开 Android Studio
    echo.
    echo 📱 请手动打开 Android Studio：
    echo    1. 打开 Android Studio
    echo    2. File → Open → 选择项目目录: frontend\android
    echo    3. 等待 Gradle 同步完成（首次可能需要几分钟下载依赖）
    echo    4. Build → Build Bundle(s) / APK(s) → Build APK
    echo    5. 等待构建完成
    echo    6. APK 位置: android\app\build\outputs\apk\release\app-release.apk
    echo.
    echo 💡 提示：如果已安装 Android Studio，可以设置环境变量：
    echo    CAPACITOR_ANDROID_STUDIO_PATH=D:\Software\Android\bin
    echo.
) else (
    echo ✅ 已打开 Android Studio
    echo.
    echo 📱 接下来在 Android Studio 中按以下步骤操作：
    echo.
    echo    步骤 1: 等待 Gradle 同步完成
    echo            - 右下角会显示 "Gradle sync in progress..."
    echo            - 首次同步可能需要 5-10 分钟（下载依赖）
    echo.
    echo    步骤 2: 构建 APK
    echo            - 点击菜单：Build → Build Bundle(s) / APK(s) → Build APK
    echo            - 等待构建完成（底部 Build 面板显示进度）
    echo            - 构建成功后会弹出通知："APK(s) generated successfully"
    echo.
    echo    步骤 3: 找到 APK 文件
    echo            - 文件位置: android\app\build\outputs\apk\release\app-release.apk
    echo            - 或者点击：Build → Build Bundle(s) / APK(s) → Locate
    echo.
    echo    步骤 4: 安装到手机
    echo            - USB 连接：手机开启 USB 调试，连接电脑，双击 APK 安装
    echo            - 扫码安装：上传 APK 到服务器，生成二维码，手机扫码下载
    echo.
    echo    💡 提示：如果构建失败，查看 Build 面板的详细错误信息
    echo.
)

echo ✅ 构建完成！
echo.

pause

