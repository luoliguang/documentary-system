import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useOrdersStore } from '../stores/orders';
import { useNotificationsStore } from '../stores/notifications';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('../components/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'OrderList',
          component: () => import('../views/orders/OrderList.vue'),
        },
        {
          path: 'orders/:id',
          name: 'OrderDetail',
          component: () => import('../views/orders/OrderDetail.vue'),
        },
        {
          path: 'orders/create',
          name: 'OrderCreate',
          component: () => import('../views/orders/OrderCreate.vue'),
          meta: { requiresAdminOrSupport: true },
        },
        {
          path: 'reminders',
          name: 'Reminders',
          component: () => import('../views/reminders/ReminderList.vue'),
        },
        {
          path: 'follow-ups',
          name: 'FollowUpDashboard',
          component: () => import('../views/followups/FollowUpDashboard.vue'),
          meta: { requiresProduction: true },
        },
        {
          path: 'profile',
          name: 'Profile',
          component: () => import('../views/users/Profile.vue'),
        },
        {
          path: 'users',
          name: 'UserList',
          component: () => import('../views/users/UserList.vue'),
          meta: { requiresAdminOrSupport: true },
        },
        {
          path: 'configs',
          name: 'ConfigManagement',
          component: () => import('../views/configs/ConfigManagement.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
  ],
});

// 导航守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
    return;
  }

  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/');
    return;
  }

  if (to.meta.requiresAdmin && !authStore.canManageSystem) {
    next('/');
    return;
  }
  if (to.meta.requiresAdminOrSupport && !authStore.canManageOrders) {
    next('/');
    return;
  }
  if (to.meta.requiresProduction && !authStore.isProductionManager) {
    next('/');
    return;
  }

  // 如果已登录且进入需要认证的页面，初始化实时推送
  if (authStore.isAuthenticated && to.meta.requiresAuth) {
    const ordersStore = useOrdersStore();
    const notificationsStore = useNotificationsStore();
    
    // 初始化实时推送（内部会检查是否已连接，避免重复）
    ordersStore.initRealtime();
    notificationsStore.initRealtime();
    notificationsStore.startPolling(); // 保留轮询作为兜底
  }

  next();
});

export default router;

