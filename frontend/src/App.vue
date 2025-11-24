<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { isCapacitorApp } from './utils/device';
import { checkForUpdate } from './utils/appUpdate';

const authStore = useAuthStore();

const isFormField = (el: HTMLElement | null) => {
  if (!el) return false;
  const tagName = el.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  return Boolean(
    el.closest('.el-input__inner') ||
    el.closest('.el-textarea__inner') ||
    el.closest('.el-select') ||
    el.closest('.el-date-editor')
  );
};

const needsViewportAdjust = (el: HTMLElement) => {
  const viewport = window.visualViewport;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportTop = viewport?.offsetTop ?? 0;
  const rect = el.getBoundingClientRect();
  const top = rect.top - viewportTop;
  const bottom = rect.bottom - viewportTop;
  return top < 0 || bottom > viewportHeight;
};

// 键盘挡输入框处理：仅在元素被遮挡时滚动，避免无谓跳动
const handleInputFocus = (e: Event) => {
  const target = e.target as HTMLElement | null;
  if (!target || !isFormField(target)) {
    return;
  }

  window.setTimeout(() => {
    if (!document.body.contains(target)) {
      return;
    }
    if (!needsViewportAdjust(target)) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 250);
};

// PWA 安装提示
const handleBeforeInstallPrompt = (e: Event) => {
  e.preventDefault();
  // 可以在这里显示"添加到主屏幕"按钮
  // const deferredPrompt = e;
};

const handleAppInstalled = () => {
  // PWA 已安装
};

onMounted(async () => {
  // 如果已有token，尝试获取用户信息
  if (authStore.isAuthenticated) {
    try {
      await authStore.fetchCurrentUser();
    } catch (error) {
      // 如果token无效，清除并跳转到登录页
      authStore.logout();
    }
  }

  // 监听输入框聚焦事件
  document.addEventListener('focusin', handleInputFocus);

  // PWA 安装提示
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  // Service Worker 注册
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(() => {
        // Service Worker registered successfully
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  }

  // App 启动时检查更新（仅 Capacitor 环境，延迟 3 秒避免影响启动速度）
  if (isCapacitorApp() && authStore.isAuthenticated) {
    setTimeout(() => {
      checkForUpdate(false).catch(() => {
        // 静默失败，不影响用户体验
      });
    }, 3000);
  }
});

onUnmounted(() => {
  document.removeEventListener('focusin', handleInputFocus);
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100%;
  min-height: 100vh;
  /* 移动端安全区域适配（底部和左右） */
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  /* 顶部不添加 padding，由 header 处理状态栏高度 */
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
    'Noto Color Emoji';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 全局移动端日期选择器优化 */
@media (max-width: 768px) {
  /* 日期选择器弹窗：全屏显示 */
  :global(.mobile-date-picker-popper),
  :global(.mobile-datetime-picker-popper) {
    width: 100vw !important;
    max-width: 100vw !important;
    left: 0 !important;
    right: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    position: fixed !important;
    top: 0 !important;
    bottom: 0 !important;
    height: 100vh !important;
    z-index: 3000 !important;
    border-radius: 0 !important;
  }

  :global(.mobile-date-picker-popper .el-picker__panel),
  :global(.mobile-datetime-picker-popper .el-picker__panel) {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }

  /* 日期范围选择器：强制单月显示，隐藏第二个月份 */
  :global(.mobile-date-picker-popper .el-date-range-picker__content) {
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    flex: 1 !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }

  :global(.mobile-date-picker-popper .el-date-range-picker__content.is-left) {
    width: 100% !important;
    padding: 0 !important;
    margin: 0 auto !important;
  }

  /* 隐藏第二个月份面板 */
  :global(.mobile-date-picker-popper .el-date-range-picker__content.is-right) {
    display: none !important;
  }

  /* 单日期选择器和日期时间选择器优化 */
  :global(.mobile-date-picker-popper .el-date-picker__header),
  :global(.mobile-datetime-picker-popper .el-date-picker__header) {
    padding: 15px 20px !important;
    border-bottom: 1px solid #e4e7ed !important;
    flex-shrink: 0 !important;
  }

  :global(.mobile-date-picker-popper .el-picker-panel__content),
  :global(.mobile-datetime-picker-popper .el-picker-panel__content) {
    width: 100% !important;
    flex: 1 !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
  }

  /* 日期时间选择器：时间面板优化 */
  :global(.mobile-datetime-picker-popper .el-time-panel) {
    width: 100% !important;
    margin: 0 !important;
  }

  :global(.mobile-datetime-picker-popper .el-time-spinner__wrapper) {
    width: 100% !important;
  }

  /* 日期选择器表格优化 */
  :global(.mobile-date-picker-popper .el-date-table),
  :global(.mobile-datetime-picker-popper .el-date-table) {
    width: 100% !important;
  }

  :global(.mobile-date-picker-popper .el-date-table td),
  :global(.mobile-datetime-picker-popper .el-date-table td) {
    padding: 6px !important;
  }

  :global(.mobile-date-picker-popper .el-date-table th),
  :global(.mobile-datetime-picker-popper .el-date-table th) {
    padding: 8px 0 !important;
  }

  /* 确保日期选择器内容不溢出 */
  :global(.mobile-date-picker-popper .el-picker-panel__body),
  :global(.mobile-datetime-picker-popper .el-picker-panel__body) {
    width: 100% !important;
    overflow-x: hidden !important;
    flex: 1 !important;
    display: flex !important;
    flex-direction: column !important;
  }

  /* 日期选择器底部按钮区域 */
  :global(.mobile-date-picker-popper .el-picker-panel__footer),
  :global(.mobile-datetime-picker-popper .el-picker-panel__footer) {
    padding: 15px 20px !important;
    border-top: 1px solid #e4e7ed !important;
    flex-shrink: 0 !important;
  }

  /* 日期范围选择器底部按钮 */
  :global(.mobile-date-picker-popper .el-picker-panel__footer .el-button) {
    min-height: 44px !important;
    font-size: 16px !important;
  }
}
</style>

