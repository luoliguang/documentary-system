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

    if (statusBarModule) {
      const { StatusBar, Style } = statusBarModule;
      // 初始化状态栏
      // 设置为 Light 样式（深色文字），背景色为浅色
      StatusBar.setStyle({ style: Style.Light });
      StatusBar.setBackgroundColor({ color: '#409eff' });
      // 设置状态栏覆盖模式，让内容可以延伸到状态栏下方
      StatusBar.setOverlaysWebView({ overlay: false });
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

