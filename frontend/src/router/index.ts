import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

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
          meta: { requiresAdmin: true },
        },
        {
          path: 'reminders',
          name: 'Reminders',
          component: () => import('../views/reminders/ReminderList.vue'),
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
          meta: { requiresAdmin: true },
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

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/');
    return;
  }

  next();
});

export default router;

