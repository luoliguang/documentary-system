import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import App from './App.vue';
import router from './router';
import { useNotificationsStore } from './stores/notifications';
import { isCapacitorApp } from './utils/device';
import { persistedStatePlugin } from './plugins/persistedState';

const app = createApp(App);
const pinia = createPinia();
pinia.use(persistedStatePlugin());

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
    import('@capacitor/local-notifications').catch(() => null),
  ]).then(([appModule, statusBarModule, splashScreenModule, localNotificationsModule]) => {
    // 初始化通知权限（App 启动时主动请求）
    if (localNotificationsModule) {
      const { LocalNotifications } = localNotificationsModule;
      LocalNotifications.checkPermissions().then((status) => {
        if (status.display !== 'granted') {
          // 主动请求通知权限
          LocalNotifications.requestPermissions().then((result) => {
            if (result.display === 'granted') {
              console.log('通知权限已授予');
            } else {
              console.warn('用户拒绝了通知权限');
            }
          });
        }
      });

      // 监听通知点击事件
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const notification = action.notification;
        const extra = notification.extra;
        if (extra) {
          // 根据通知类型跳转到相应页面
          if (extra.relatedType === 'order' && extra.relatedId) {
            router.push(`/orders/${extra.relatedId}`);
          } else if (extra.relatedType === 'reminder') {
            router.push('/reminders');
          } else if (extra.relatedType === 'order_feedback') {
            router.push('/order-feedbacks');
          }
        }
      });
    }

    if (appModule) {
      const { App: CapacitorApp } = appModule;
      
      // 监听 App 状态变化
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        const notificationsStore = useNotificationsStore();
        if (isActive) {
          // App 进入前台，立即刷新数据
          notificationsStore.fetchUnreadCount();
        } else {
          // App 进入后台，确保轮询继续（虽然可能被系统限制）
          // 轮询机制会继续运行，但频率可能降低
          console.log('App 进入后台，轮询将继续运行');
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

    // StatusBar 初始化（仅在真正的 Capacitor App 环境中）
    // 检查是否是真正的原生 App 环境（不是 Web 开发环境）
    // 在 Web 开发环境中（http://localhost），即使有 Capacitor 对象，StatusBar 插件也不可用
    const isRealCapacitorApp = isCapacitorApp() && 
      window.location.protocol === 'capacitor:';
    
    if (statusBarModule && isRealCapacitorApp) {
      try {
        const { StatusBar, Style } = statusBarModule;
        // 初始化状态栏
        // 设置为 Light 样式（深色文字），背景色为浅色
        StatusBar.setStyle({ style: Style.Light }).catch(() => {
          // 静默失败，可能是 Web 环境
        });
        StatusBar.setBackgroundColor({ color: '#409eff' }).catch(() => {
          // 静默失败，可能是 Web 环境
        });
        // 设置状态栏覆盖模式，让内容可以延伸到状态栏下方
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {
          // 静默失败，可能是 Web 环境
        });
        
        // 获取状态栏高度并设置 CSS 变量（仅移动端，桌面端为 0）
        // 注意：StatusBar 插件可能没有 getInfo，使用默认值
        // Android 设备通常状态栏高度为 24-48px，华为设备通常为 24px
        // 桌面端始终为 0，移动端才设置高度
        const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const defaultStatusBarHeight = isMobile ? 24 : 0;
        document.documentElement.style.setProperty('--status-bar-height', `${defaultStatusBarHeight}px`);
        
        // 尝试使用 window 对象获取状态栏高度（仅移动端）
        if (isMobile && typeof (window as any).devicePixelRatio !== 'undefined') {
          // 某些设备可以通过 screen 对象获取
          try {
            const screenHeight = window.screen.height;
            const windowHeight = window.innerHeight;
            const statusBarHeight = Math.max(0, screenHeight - windowHeight - 60); // 60 是 header 高度
            if (statusBarHeight > 0 && statusBarHeight < 100) {
              document.documentElement.style.setProperty('--status-bar-height', `${statusBarHeight}px`);
            }
          } catch (e) {
            // 忽略错误，使用默认值
          }
        }
      } catch (error) {
        // Web 环境中 StatusBar 插件不可用，静默失败
        // 不输出警告，避免在开发环境中产生噪音
        // Web 环境设置状态栏高度为 0
        document.documentElement.style.setProperty('--status-bar-height', '0px');
      }
    } else {
      // 非 Capacitor 环境（Web 浏览器）
      // 在移动设备视图中，设置模拟状态栏高度以便开发预览
      // 注意：这只是为了开发时预览效果，真正的 App 中会使用实际的状态栏高度
      const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const simulatedStatusBarHeight = isMobile ? 24 : 0; // 模拟 Android 状态栏高度
      document.documentElement.style.setProperty('--status-bar-height', `${simulatedStatusBarHeight}px`);
      
      // 监听窗口大小变化，动态更新状态栏高度（用于响应式开发）
      const updateStatusBarHeight = () => {
        const currentIsMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const height = currentIsMobile ? 24 : 0;
        document.documentElement.style.setProperty('--status-bar-height', `${height}px`);
      };
      
      window.addEventListener('resize', updateStatusBarHeight);
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

