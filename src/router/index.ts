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
    redirect: { name: 'projects' },
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
    path: '/projects/:projectId',
    name: 'projects.detail',
    component: () => import('@/views/AttendanceView.vue'),
    props: true,
    meta: { title: 'Project Attendance' },
  },
  {
    path: '/projects/:projectId/attendance-scan-qr',
    name: 'projects.attendance-scan-qr',
    component: () => import('@/views/AttendanceScanView.vue'),
    props: true,
    meta: { title: 'Scan Attendance', fullscreen: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'projects' },
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
    return { name: 'projects' };
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
