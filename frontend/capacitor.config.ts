import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gendan.app',
  appName: '方度跟单系统',
  webDir: 'dist',
  server: {
    // 生产环境使用域名
    url: 'https://order.fangdutex.cn',
    // 本地开发时允许 http（调试用）
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#409eff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#409eff',
      sound: 'beep.wav',
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#409eff',
    },
  },
};

export default config;

