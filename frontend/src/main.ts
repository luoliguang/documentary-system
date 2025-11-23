import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import App from './App.vue';
import router from './router';
import { useOrdersStore } from './stores/orders';
import { useNotificationsStore } from './stores/notifications';
import { useAuthStore } from './stores/auth';
import { isCapacitorApp } from './utils/device';

const app = createApp(App);
const pinia = createPinia();

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(pinia);
app.use(router);
app.use(ElementPlus, {
  locale: zhCn,
});

// 初始化 Capacitor（如果是原生 App）
if (isCapacitorApp()) {
  // 动态导入 Capacitor 插件（避免在非 Capacitor 环境中报错）
  Promise.all([
    import('@capacitor/app').catch(() => null),
    import('@capacitor/status-bar').catch(() => null),
    import('@capacitor/splash-screen').catch(() => null),
  ]).then(([appModule, statusBarModule, splashScreenModule]) => {
    if (appModule) {
      const { App: CapacitorApp } = appModule;
      
      // 监听 App 状态变化
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // App 进入前台，刷新数据
          const notificationsStore = useNotificationsStore();
          notificationsStore.fetchUnreadCount();
        }
      });

      // 监听返回按钮（Android）
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
      });
    }

    if (statusBarModule) {
      const { StatusBar, Style } = statusBarModule;
      // 初始化状态栏
      StatusBar.setStyle({ style: Style.Default });
      StatusBar.setBackgroundColor({ color: '#409eff' });
    }

    if (splashScreenModule) {
      const { SplashScreen } = splashScreenModule;
      // 隐藏启动屏
      SplashScreen.hide();
    }
  }).catch((error) => {
    console.warn('Capacitor 初始化失败:', error);
  });
}

app.mount('#app');

