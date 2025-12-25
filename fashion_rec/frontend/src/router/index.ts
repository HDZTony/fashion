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
import { supabase } from '../lib/supabase'

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
        component: Studio,
        meta: { requiresAuth: true }
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
  router.beforeEach(async (to, _from, next) => {
    // For protected routes, ensure session is loaded (handles page refresh)
    if (to.meta.requiresAuth) {
      let attempts = 0
      let session = null
      
      // Retry up to 3 times to allow Supabase session to recover on page refresh
      while (attempts < 3 && !session) {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn('Failed to get Supabase session', error)
          break
        }
        session = data.session
        
        if (!session && attempts < 2) {
          // Wait a bit for session to recover (Supabase may need time on page refresh)
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        attempts++
      }
      
      const token = session?.access_token

      // Keep legacy token in sync to avoid stale state in older code
      if (typeof window !== 'undefined') {
        if (token) {
          localStorage.setItem('auth_token', token)
        } else {
          localStorage.removeItem('auth_token')
        }
      }

      if (!token) {
        next('/login')
        return
      }
    } else {
      // For non-protected routes, just sync token if available
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (typeof window !== 'undefined') {
        if (token) {
          localStorage.setItem('auth_token', token)
        } else {
          localStorage.removeItem('auth_token')
        }
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
