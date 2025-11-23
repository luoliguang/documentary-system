<template>
  <el-container class="main-layout">
    <el-header class="layout-header">
      <div class="header-left">
        <el-button
          class="menu-toggle-btn"
          circle
          @click="drawerVisible = true"
        >
          <el-icon>
            <Menu />
          </el-icon>
        </el-button>
        <el-icon :size="24" color="#409eff" class="logo-icon">
          <EditPen />
        </el-icon>
        <span class="logo-text">方度跟单系统</span>
      </div>
      <div class="header-right">
        <!-- 通知图标 -->
        <el-badge
          v-if="authStore.canManageOrders || authStore.isProductionManager || authStore.isCustomer"
          :value="notificationsStore.unreadCount"
          :hidden="notificationsStore.unreadCount === 0"
          class="notification-badge"
        >
          <el-button
            circle
            @click="notificationCenterVisible = true"
            class="notification-btn"
          >
            <el-icon><Bell /></el-icon>
          </el-button>
        </el-badge>
        <el-dropdown @command="handleCommand">
          <span class="user-info">
            <el-icon><User /></el-icon>
            <span class="user-name">{{ authStore.user?.company_name || authStore.user?.username }}</span>
            <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>
                {{
                  authStore.user?.role === 'admin'
                    ? '管理员'
                    : authStore.user?.role === 'production_manager'
                    ? '生产跟单'
                    : (authStore.user?.role as string) === 'customer_service'
                    ? '客服'
                    : '客户'
                }}：{{ authStore.user?.username }}
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="layout-container">
      <!-- 桌面端侧边栏 -->
      <el-aside width="200px" class="layout-aside desktop-aside">
        <el-menu
          :default-active="activeMenu"
          router
          class="sidebar-menu"
        >
          <el-menu-item index="/">
            <el-icon><List /></el-icon>
            <span>订单列表</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageReminders"
            index="/reminders"
          >
            <el-icon><Bell /></el-icon>
            <span>催货记录</span>
          </el-menu-item>
          <el-menu-item
            v-else-if="authStore.isProductionManager"
            index="/follow-ups"
          >
            <el-icon><Bell /></el-icon>
            <span>跟进记录</span>
          </el-menu-item>
          <el-menu-item
            v-else-if="authStore.isCustomer"
            index="/reminders"
          >
            <el-icon><Bell /></el-icon>
            <span>催单记录</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageOrders"
            index="/orders/create"
          >
            <el-icon><Plus /></el-icon>
            <span>创建订单</span>
          </el-menu-item>
          <el-menu-item index="/profile">
            <el-icon><User /></el-icon>
            <span>个人中心</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageSystem"
            index="/users"
          >
            <el-icon><Setting /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageSystem"
            index="/configs"
          >
            <el-icon><Tools /></el-icon>
            <span>系统配置</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageOrders || authStore.isCustomer"
            index="/order-feedbacks"
          >
            <el-icon><QuestionFilled /></el-icon>
            <span>{{ authStore.isCustomer ? '我的反馈' : '订单编号反馈' }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 移动端抽屉式侧边栏 -->
      <el-drawer
        v-model="drawerVisible"
        title="菜单"
        direction="ltr"
        size="250px"
        class="mobile-drawer"
      >
        <el-menu
          :default-active="activeMenu"
          router
          class="sidebar-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="/">
            <el-icon><List /></el-icon>
            <span>订单列表</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageReminders"
            index="/reminders"
          >
            <el-icon><Bell /></el-icon>
            <span>催货记录</span>
          </el-menu-item>
          <el-menu-item
            v-else-if="authStore.isProductionManager"
            index="/follow-ups"
          >
            <el-icon><Bell /></el-icon>
            <span>跟进记录</span>
          </el-menu-item>
          <el-menu-item
            v-else-if="authStore.isCustomer"
            index="/reminders"
          >
            <el-icon><Bell /></el-icon>
            <span>催单记录</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageOrders"
            index="/orders/create"
          >
            <el-icon><Plus /></el-icon>
            <span>创建订单</span>
          </el-menu-item>
          <el-menu-item index="/profile">
            <el-icon><User /></el-icon>
            <span>个人中心</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageSystem"
            index="/users"
          >
            <el-icon><Setting /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageSystem"
            index="/configs"
          >
            <el-icon><Tools /></el-icon>
            <span>系统配置</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.canManageOrders || authStore.isCustomer"
            index="/order-feedbacks"
          >
            <el-icon><QuestionFilled /></el-icon>
            <span>{{ authStore.isCustomer ? '我的反馈' : '订单编号反馈' }}</span>
          </el-menu-item>
        </el-menu>
      </el-drawer>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>

    <!-- 通知中心 -->
    <NotificationCenter v-model="notificationCenterVisible" />

    <!-- 移动端底部 TabBar -->
    <div class="mobile-tabbar">
      <div
        class="tabbar-item"
        :class="{ active: activeMenu === '/' }"
        @click="handleTabClick('/')"
      >
        <el-icon><List /></el-icon>
        <span>订单</span>
      </div>
      <div
        v-if="authStore.canManageReminders || authStore.isProductionManager || authStore.isCustomer"
        class="tabbar-item"
        :class="{
          active:
            activeMenu === '/reminders' ||
            activeMenu === '/follow-ups',
        }"
        @click="handleTabClick(authStore.canManageReminders ? '/reminders' : authStore.isProductionManager ? '/follow-ups' : '/reminders')"
      >
        <el-icon><Bell /></el-icon>
        <span>催单</span>
        <el-badge
          v-if="notificationsStore.unreadCount > 0"
          :value="notificationsStore.unreadCount"
          class="tabbar-badge"
        />
      </div>
      <div
        v-if="authStore.canManageOrders"
        class="tabbar-item"
        :class="{ active: activeMenu === '/orders/create' }"
        @click="handleTabClick('/orders/create')"
      >
        <el-icon><Plus /></el-icon>
        <span>创建</span>
      </div>
      <div
        class="tabbar-item"
        :class="{ active: activeMenu === '/profile' }"
        @click="handleTabClick('/profile')"
      >
        <el-icon><User /></el-icon>
        <span>我的</span>
      </div>
    </div>
  </el-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Bell, User, List, Plus, QuestionFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { useNotificationsStore } from '../../stores/notifications';
// @ts-ignore - Vue SFC with script setup
import NotificationCenter from '../NotificationCenter.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

const activeMenu = computed(() => route.path);
const drawerVisible = ref(false);
const notificationCenterVisible = ref(false);

const handleCommand = (command: string) => {
  if (command === 'logout') {
    authStore.logout();
    notificationsStore.reset();
    ElMessage.success('已退出登录');
  }
};

const handleMenuSelect = () => {
  // 移动端选择菜单项后自动关闭抽屉
  if (window.innerWidth <= 768) {
    drawerVisible.value = false;
  }
};

const handleTabClick = (path: string) => {
  if (route.path !== path) {
    router.push(path);
  }
};

// 启动通知轮询
onMounted(() => {
  if (
    authStore.isAuthenticated &&
    (authStore.canManageOrders || authStore.isProductionManager || authStore.isCustomer)
  ) {
    notificationsStore.startPolling();
  }
});

// 停止通知轮询
onUnmounted(() => {
  notificationsStore.stopPolling();
});
</script>

<style scoped>
.main-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 20px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: 60px;
  flex-shrink: 0;
  /* 移动端状态栏适配：添加顶部安全区域 */
  padding-top: env(safe-area-inset-top, 0px);
  height: calc(60px + env(safe-area-inset-top, 0px));
  min-height: calc(60px + env(safe-area-inset-top, 0px));
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.menu-toggle-btn {
  display: none;
}

.logo-icon {
  display: inline-flex;
}

.logo-text {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.notification-badge {
  margin-right: 5px;
}

.notification-btn {
  border: none;
  background: transparent;
}

.notification-btn:hover {
  background: #f5f7fa;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: #606266;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.3s;
}

.user-info:hover {
  background: #f5f7fa;
}

.user-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.layout-container {
  margin-top: 60px;
  height: calc(100vh - 60px);
  overflow: hidden;
  display: flex;
  /* 移动端状态栏适配：考虑安全区域 */
  margin-top: calc(60px + env(safe-area-inset-top));
  height: calc(100vh - 60px - env(safe-area-inset-top));
}

.layout-aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
  position: fixed;
  left: 0;
  top: calc(60px + env(safe-area-inset-top, 0px));
  bottom: 0;
  width: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 999;
}

.desktop-aside {
  display: block;
}

.sidebar-menu {
  border-right: none;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

.mobile-drawer {
  display: none;
}

.layout-main {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  margin-left: 200px;
  height: 100%;
  -webkit-overflow-scrolling: touch;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .layout-header {
    padding: 0 15px;
  }

  .menu-toggle-btn {
    display: inline-flex;
    margin-right: 5px;
  }

  .logo-text {
    font-size: 16px;
  }

  .user-name {
    max-width: 100px;
    font-size: 14px;
  }

  .header-right :deep(.el-icon) {
    font-size: 16px;
  }

  /* 移动端布局容器调整 */
  .layout-container {
    margin-top: calc(60px + env(safe-area-inset-top, 0px));
    height: calc(100vh - 60px - env(safe-area-inset-top, 0px));
  }
  
  /* 移动端 Header 适配状态栏 */
  .layout-header {
    padding-top: env(safe-area-inset-top, 0px);
    height: calc(60px + env(safe-area-inset-top, 0px));
    min-height: calc(60px + env(safe-area-inset-top, 0px));
  }

  /* 移动端隐藏桌面侧边栏 */
  .desktop-aside {
    display: none !important;
  }

  /* 移动端侧边栏不固定 */
  .layout-aside {
    position: static;
    width: auto;
    top: auto;
    bottom: auto;
  }

  /* 移动端显示抽屉 */
  .mobile-drawer {
    display: block;
  }

  .layout-main {
    padding: 15px 10px;
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
    margin-left: 0;
  }

  .layout-main :deep(.el-card) {
    margin: 0;
    border-radius: 0;
  }
}

@media (min-width: 769px) {
  /* 桌面端隐藏移动端抽屉 */
  .mobile-drawer {
    display: none !important;
  }

  .desktop-aside {
    display: block;
  }

  /* 桌面端隐藏底部 TabBar */
  .mobile-tabbar {
    display: none !important;
  }

  /* 桌面端确保主内容区域有正确的左边距 */
  .layout-main {
    margin-left: 200px;
  }
}

/* 移动端底部 TabBar */
.mobile-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  padding: 8px 0;
  z-index: 1000;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  height: 56px;
}

.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  cursor: pointer;
  color: #909399;
  transition: color 0.3s;
  position: relative;
  min-height: 48px;
  padding: 4px 8px;
}

.tabbar-item .el-icon {
  font-size: 22px;
  margin-bottom: 2px;
}

.tabbar-item span {
  font-size: 12px;
}

.tabbar-item.active {
  color: #409eff;
}

.tabbar-item:active {
  opacity: 0.7;
}

.tabbar-badge {
  position: absolute;
  top: 2px;
  right: 50%;
  transform: translateX(12px);
}

/* 移动端主内容区域底部留白，避免被 TabBar 遮挡 */
@media (max-width: 768px) {
  .layout-main {
    padding-bottom: 70px !important;
  }

  .main-layout {
    padding-bottom: 56px;
  }
}
</style>

