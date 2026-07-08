import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const PUBLIC_ROUTE_NAMES = new Set(['Login', 'Register'])

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      props: true,
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/RegisterView.vue'),
      props: true,
    },
    {
      path: '/',
      name: 'Dashboard',
      component: () => import('@/views/DashboardView.vue'),
      props: true,
    },
  ],
})

// Cached so every navigation - not just the first - waits on the same in-flight `me` call
// instead of re-fetching, and so the guard's first decision always sees a resolved auth state.
let meLoaded: Promise<void> | null = null

export function primeAuth(): Promise<void> {
  const authStore = useAuthStore()
  if (!meLoaded) {
    meLoaded = authStore.fetchMe()
  }
  return meLoaded
}

router.beforeEach(async (to) => {
  await primeAuth()
  const authStore = useAuthStore()
  const isPublicRoute = PUBLIC_ROUTE_NAMES.has(to.name as string)

  if (!authStore.isAuthenticated && !isPublicRoute) {
    return { name: 'Login' }
  }

  if (authStore.isAuthenticated && isPublicRoute) {
    return { name: 'Dashboard' }
  }

  return true
})

export default router
