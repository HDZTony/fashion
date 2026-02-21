import { createMemoryHistory, createRouter, createWebHistory, type Router, type RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'
import Studio from '../views/Studio.vue'
import Login from '../views/Login.vue'
import Callback from '../views/Callback.vue'
import ResetPassword from '../views/ResetPassword.vue'
import Wardrobe from '../views/Wardrobe.vue'
import LVProducts from '../views/LVProducts.vue'
import Favorites from '../views/Favorites.vue'
import TryOnHistory from '../views/TryOnHistory.vue'
import PrivacyPolicy from '../views/PrivacyPolicy.vue'
import TermsOfService from '../views/TermsOfService.vue'
import Pricing from '../views/Pricing.vue'
import Profile from '../views/Profile.vue'
import AppLayout from '../layouts/AppLayout.vue'
import HomeLayout from '../layouts/HomeLayout.vue'
import { useAuthStore } from '../stores/auth'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: HomeLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: Home
      },
      {
        path: 'pricing',
        name: 'pricing',
        component: Pricing
      },
      {
        path: 'blog',
        name: 'blog',
        component: () => import('../views/BlogList.vue')
      },
      {
        path: 'blog/:id',
        name: 'blog-detail',
        component: () => import('../views/BlogDetail.vue')
      },
      {
        path: 'blog/create',
        name: 'blog-create',
        component: () => import('../views/BlogCreate.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'blog/:id/edit',
        name: 'blog-edit',
        component: () => import('../views/BlogCreate.vue'),
        meta: { requiresAuth: true }
      }
    ]
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: 'studio',
        name: 'studio',
        component: Studio
      },
      {
        path: 'wardrobe',
        name: 'wardrobe',
        component: Wardrobe,
        meta: { requiresAuth: true }
      },
      {
        path: 'lv-products',
        name: 'lv-products',
        component: LVProducts,
        meta: { requiresAuth: true }
      },
      {
        path: 'favorites',
        name: 'favorites',
        component: Favorites,
        meta: { requiresAuth: true }
      },
      {
        path: 'tryon-history',
        name: 'tryon-history',
        component: TryOnHistory,
        meta: { requiresAuth: true }
      },
      {
        path: 'multi-angle',
        name: 'multi-angle',
        component: () => import('../views/MultiAngle.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'multiangle-history',
        name: 'multiangle-history',
        component: () => import('../views/MultiAngleHistory.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'privacy-policy',
        name: 'privacy-policy',
        component: PrivacyPolicy
      },
      {
        path: 'terms-of-service',
        name: 'terms-of-service',
        component: TermsOfService
      },
      {
        path: 'profile',
        name: 'profile',
        component: Profile,
        meta: { requiresAuth: true }
      },
      {
        path: 'seo',
        redirect: () => ({ path: '/profile', query: { tab: 'seo' } })
      },
      {
        path: 'my-blog',
        name: 'my-blog',
        component: () => import('../views/MyBlog.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'settings/model',
        name: 'settings-model',
        component: () => import('../views/SettingsModel.vue'),
        meta: { requiresAuth: true }
      }
    ]
  },
  {
    path: '/login',
    name: 'login',
    component: Login
  },
  {
    path: '/callback',
    name: 'callback',
    component: Callback
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: ResetPassword
  }
]

export const setupRouterGuards = (router: Router) => {
  router.beforeEach(async (to, from, next) => {
    // Skip auth check in SSR (server-side rendering)
    // SSR should only render public pages, authenticated pages are rendered on client
    if (typeof window === 'undefined') {
      // In SSR, allow navigation but don't check auth
      // This ensures SSR only renders public pages (which don't require auth)
      next()
      return
    }

    const authStore = useAuthStore()

    // Handle OAuth code that landed on the wrong page (e.g. Supabase redirected to '/' instead of '/callback')
    if (to.query.code && to.name !== 'callback') {
      await authStore.loadSession()
      if (authStore.isAuthenticated) {
        next({ name: 'studio', replace: true })
        return
      }
    }

    // Mark route navigation (not page refresh) for Studio page
    // This helps Studio.vue distinguish between route navigation and page refresh
    if (to.name === 'studio' && from.name) {
      // Only set marker if navigating from another route (not initial load)
      sessionStorage.setItem('studio-route-navigation', 'true')
    }

    // Wait for initial session load if still loading
    if (authStore.isLoading) {
      await authStore.loadSession()
    }

    // For protected routes, check authentication
    if (to.meta.requiresAuth) {
      if (!authStore.isAuthenticated) {
        next({ name: 'login', query: { redirect: to.fullPath } })
        return
      }
    }

    next()
  })
}

export const createAppRouter = () => {
  const history =
    typeof window === 'undefined'
      ? createMemoryHistory(import.meta.env.BASE_URL)
      : createWebHistory(import.meta.env.BASE_URL)

  const router = createRouter({
    history,
    routes,
  })
  setupRouterGuards(router)
  return router
}

const router = createAppRouter()
export default router
