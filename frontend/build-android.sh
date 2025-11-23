#!/bin/bash

# 方度跟单系统 - Android 一键打包脚本
# 使用方法: ./build-android.sh

set -e

echo "🚀 开始构建 Android APK..."

# 1. 构建前端
echo "📦 步骤 1/4: 构建前端项目..."
npm run build

# 2. 复制资源到 Android
echo "📋 步骤 2/4: 复制资源到 Android 项目..."
npx cap copy

# 3. 同步插件
echo "🔄 步骤 3/4: 同步 Capacitor 插件..."
npx cap sync

# 临时关闭 set -e，因为打开 Android Studio 失败不应该中断脚本
set +e

# 4. 打开 Android Studio
echo "🎯 步骤 4/4: 尝试打开 Android Studio..."
echo ""

if npx cap open android 2>/dev/null; then
    echo "✅ 已打开 Android Studio"
    echo ""
    echo "📱 接下来在 Android Studio 中："
    echo "   1. 等待 Gradle 同步完成"
    echo "   2. Build → Build Bundle(s) / APK(s) → Build APK"
    echo "   3. 等待构建完成"
    echo "   4. APK 位置: android/app/build/outputs/apk/release/app-release.apk"
    echo ""
else
    echo "⚠️  无法自动打开 Android Studio"
    echo ""
    echo "📱 请手动打开 Android Studio："
    echo "   1. 打开 Android Studio"
    echo "   2. File → Open → 选择项目目录: frontend/android"
    echo "   3. 等待 Gradle 同步完成"
    echo "   4. Build → Build Bundle(s) / APK(s) → Build APK"
    echo "   5. 等待构建完成"
    echo "   6. APK 位置: android/app/build/outputs/apk/release/app-release.apk"
    echo ""
    echo "💡 提示：如果已安装 Android Studio，可以设置环境变量："
    echo "   export CAPACITOR_ANDROID_STUDIO_PATH=/path/to/android-studio"
    echo ""
fi

# 重新启用 set -e（如果需要）
set -e

echo "✅ 构建完成！"
echo ""

