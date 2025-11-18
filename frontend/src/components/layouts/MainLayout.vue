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
        <span class="logo-text">跟单系统</span>
      </div>
      <div class="header-right">
        <!-- 通知图标 -->
        <el-badge
          v-if="authStore.isAdmin || authStore.isProductionManager || authStore.isCustomer"
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
                    : '客户'
                }}：{{ authStore.user?.username }}
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container>
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
            v-if="authStore.isAdmin"
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
            v-if="authStore.isAdmin"
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
            v-if="authStore.isAdmin"
            index="/users"
          >
            <el-icon><Setting /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.isAdmin"
            index="/configs"
          >
            <el-icon><Tools /></el-icon>
            <span>系统配置</span>
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
            v-if="authStore.isAdmin"
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
            v-if="authStore.isAdmin"
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
            v-if="authStore.isAdmin"
            index="/users"
          >
            <el-icon><Setting /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item
            v-if="authStore.isAdmin"
            index="/configs"
          >
            <el-icon><Tools /></el-icon>
            <span>系统配置</span>
          </el-menu-item>
        </el-menu>
      </el-drawer>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>

    <!-- 通知中心 -->
    <NotificationCenter v-model="notificationCenterVisible" />
  </el-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Bell, User } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { useNotificationsStore } from '../../stores/notifications';
// @ts-ignore - Vue SFC with script setup
import NotificationCenter from '../NotificationCenter.vue';

const route = useRoute();
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

// 启动通知轮询
onMounted(() => {
  if (
    authStore.isAuthenticated &&
    (authStore.isAdmin || authStore.isProductionManager || authStore.isCustomer)
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
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 20px;
  position: relative;
  z-index: 1000;
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

.layout-aside {
  background: #fff;
  border-right: 1px solid #e4e7ed;
}

.desktop-aside {
  display: block;
}

.sidebar-menu {
  border-right: none;
}

.mobile-drawer {
  display: none;
}

.layout-main {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
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

  /* 移动端隐藏桌面侧边栏 */
  .desktop-aside {
    display: none !important;
  }

  /* 移动端显示抽屉 */
  .mobile-drawer {
    display: block;
  }

  .layout-main {
    padding: 15px 10px;
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
}
</style>

