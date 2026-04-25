import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Sign in', public: true },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Cube Scanner' },
  },
  {
    path: '/scan',
    name: 'scanner',
    component: () => import('@/views/ScannerView.vue'),
    meta: { title: 'Scan QR' },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/ProjectsView.vue'),
    meta: { title: 'Projects' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { title: 'My profile' },
  },
  {
    path: '/employees',
    name: 'employees',
    component: () => import('@/views/EmployeesView.vue'),
    meta: { title: 'Employees' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'home' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  const isPublic = to.meta?.public === true;

  if (!isPublic && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' };
  }
  return true;
});

router.afterEach((to) => {
  const title = (to.meta?.title as string | undefined) ?? 'Cube Scanner';
  if (typeof document !== 'undefined') {
    document.title = title;
  }
});

export default router;
