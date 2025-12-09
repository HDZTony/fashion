import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Callback from '../views/Callback.vue'
import ResetPassword from '../views/ResetPassword.vue'
import History from '../views/History.vue'
import Wardrobe from '../views/Wardrobe.vue'
import LVProducts from '../views/LVProducts.vue'
import Favorites from '../views/Favorites.vue'
import TryOnHistory from '../views/TryOnHistory.vue'
import PrivacyPolicy from '../views/PrivacyPolicy.vue'
import TermsOfService from '../views/TermsOfService.vue'
import Pricing from '../views/Pricing.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: { requiresAuth: true }
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
    },
    {
      path: '/history',
      name: 'history',
      component: History,
      meta: { requiresAuth: true }
    },
    {
      path: '/wardrobe',
      name: 'wardrobe',
      component: Wardrobe,
      meta: { requiresAuth: true }
    },
    {
      path: '/lv-products',
      name: 'lv-products',
      component: LVProducts,
      meta: { requiresAuth: true }
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: Favorites,
      meta: { requiresAuth: true }
    },
    {
      path: '/tryon-history',
      name: 'tryon-history',
      component: TryOnHistory,
      meta: { requiresAuth: true }
    },
    {
      path: '/privacy-policy',
      name: 'privacy-policy',
      component: PrivacyPolicy
    },
    {
      path: '/terms-of-service',
      name: 'terms-of-service',
      component: TermsOfService
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: Pricing,
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('auth_token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
