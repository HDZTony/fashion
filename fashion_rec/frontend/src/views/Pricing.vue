<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Choose the plan that fits you</h1>
        <p class="text-lg text-gray-600">Unlock more virtual try-on power</p>
      </div>

      <!-- Pricing Cards -->
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
        <!-- Free Plan -->
        <div class="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 hover:border-blue-500 transition-all">
          <div class="text-center">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Free</h2>
            <div class="mb-6">
              <span class="text-5xl font-bold text-gray-900">$0</span>
              <span class="text-gray-600 ml-2">/mo</span>
            </div>
            <ul class="text-left space-y-4 mb-8">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-gray-700">3 virtual try-ons per day (first 3 tries are free for all plans)</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-gray-700">Access to core features</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-gray-700">Save your history</span>
              </li>
            </ul>
            <button
              @click="selectPlan('free')"
              class="w-full py-3 px-6 rounded-lg font-semibold transition-all bg-gray-100 text-gray-900 hover:bg-gray-200"
            >
              Continue with Free
            </button>
          </div>
        </div>

        <!-- Premium Plan -->
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl border-2 border-blue-500 p-8 text-white relative transform hover:scale-105 transition-all">
          <!-- Popular Badge -->
          <div class="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <span class="bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold">Recommended</span>
          </div>
          
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-2">Premium</h2>
            <div class="mb-6">
              <span class="text-5xl font-bold">$5</span>
              <span class="text-blue-100 ml-2">/mo</span>
            </div>
            <ul class="text-left space-y-4 mb-8">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>30 virtual try-ons per month</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Includes all Free features</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Priority processing</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Unlimited history</span>
              </li>
            </ul>
            <button
              @click="selectPlan('premium')"
              :disabled="isLoading"
              :class="[
                'w-full py-3 px-6 rounded-lg font-semibold transition-all',
                isLoading
                  ? 'bg-white/80 text-blue-600 cursor-wait'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              ]"
            >
              {{ isLoading ? 'Processing...' : 'Subscribe now' }}
            </button>
          </div>
        </div>

        <!-- Premium Plus Plan -->
        <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl border-2 border-purple-500 p-8 text-white relative transform hover:scale-105 transition-all">
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-2">Premium Plus</h2>
            <div class="mb-6">
              <span class="text-5xl font-bold">$15</span>
              <span class="text-purple-100 ml-2">/mo</span>
            </div>
            <ul class="text-left space-y-4 mb-8">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>100 virtual try-ons per month</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Includes all Premium features</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Priority processing</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Unlimited history</span>
              </li>
            </ul>
            <button
              @click="selectPlan('premium_plus')"
              :disabled="isLoading"
              :class="[
                'w-full py-3 px-6 rounded-lg font-semibold transition-all',
                isLoading
                  ? 'bg-white/80 text-purple-600 cursor-wait'
                  : 'bg-white text-purple-600 hover:bg-purple-50'
              ]"
            >
              {{ isLoading ? 'Processing...' : 'Subscribe now' }}
            </button>
          </div>
        </div>

        <!-- Premium Pro Plan -->
        <div class="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl shadow-xl border-2 border-indigo-500 p-8 text-white relative transform hover:scale-105 transition-all">
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-2">Premium Pro</h2>
            <div class="mb-6">
              <span class="text-5xl font-bold">$29.9</span>
              <span class="text-indigo-100 ml-2">/mo</span>
            </div>
            <ul class="text-left space-y-4 mb-8">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>250 virtual try-ons per month</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Includes all Premium Plus features</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Priority processing</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Unlimited history</span>
              </li>
            </ul>
            <button
              @click="selectPlan('premium_pro')"
              :disabled="isLoading"
              :class="[
                'w-full py-3 px-6 rounded-lg font-semibold transition-all',
                isLoading
                  ? 'bg-white/80 text-indigo-600 cursor-wait'
                  : 'bg-white text-indigo-600 hover:bg-indigo-50'
              ]"
            >
              {{ isLoading ? 'Processing...' : 'Subscribe now' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="mt-6 max-w-4xl mx-auto">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { supabase } from '../lib/supabase'

defineOptions({ name: 'Pricing' })

const router = useRouter()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SUBSCRIPTION_API_URL = import.meta.env.VITE_SUBSCRIPTION_API_URL || 'http://localhost:3001'

const isLoading = ref(false)
const error = ref<string | null>(null)
const subscriptionInfo = ref<any>(null)
// 从后端获取环境配置
const isTestMode = ref(false)
const productIds = ref<{
  premium: { test: string; prod: string }
  premiumPlus: { test: string; prod: string }
  premiumPro: { test: string; prod: string }
} | null>(null)

// 从后端加载环境配置
const loadConfig = async () => {
  try {
    const response = await subscriptionClient.get('/config')
    isTestMode.value = response.data.isTestMode
    productIds.value = response.data.productIds
    console.log('Environment config loaded:', { isTestMode: isTestMode.value, productIds: productIds.value })
  } catch (error: any) {
    console.error('Failed to load config from backend, using fallback:', error)
    // 如果后端配置加载失败，使用环境变量作为后备
    isTestMode.value = import.meta.env.VITE_CREEM_TEST_MODE === 'true'
    productIds.value = {
      premium: {
        test: import.meta.env.VITE_CREEM_PRODUCT_ID_TEST || '',
        prod: import.meta.env.VITE_CREEM_PRODUCT_ID_PROD || '',
      },
      premiumPlus: {
        test: import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS_TEST || '',
        prod: import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS_PROD || '',
      },
      premiumPro: {
        test: import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PRO_TEST || '',
        prod: import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PRO_PROD || '',
      },
    }
  }
}

// Create axios client with auth headers
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (e) {
    console.warn('Failed to get Supabase session:', e)
  }
  return config
})

// Subscription service client
const subscriptionClient = axios.create({
  baseURL: SUBSCRIPTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Load subscription info
const loadSubscriptionInfo = async () => {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Please sign in first')
    }

    // Call subscription-service directly
    const session = await supabase.auth.getSession()
    const response = await subscriptionClient.get('/subscription/status', {
      params: { user_id: user.id },
      headers: {
        Authorization: `Bearer ${session.data.session?.access_token || user.id}`,
      },
    })
    subscriptionInfo.value = response.data
  } catch (error: any) {
    console.error('Failed to load subscription info:', error)
    // If the user has no subscription, default to Free
    subscriptionInfo.value = {
      planName: 'Free',
      remainingTries: 0,
      totalTries: 1,
      period: 'daily',
    }
  }
}

// Choose plan
const selectPlan = async (plan: 'free' | 'premium' | 'premium_plus' | 'premium_pro') => {
  if (plan === 'free') {
    // Free plan does not require payment
    router.push('/studio')
    return
  }

  if (plan === 'premium' || plan === 'premium_plus' || plan === 'premium_pro') {
    isLoading.value = true
    error.value = null

    try {
      // 获取当前用户信息
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Please sign in first')
      }

      // 确保配置已加载
      if (!productIds.value) {
        await loadConfig()
      }

      // Create checkout session
      // 根据后端返回的环境配置选择产品ID
      let productId: string
      if (plan === 'premium_pro') {
        productId = isTestMode.value 
          ? (productIds.value?.premiumPro.test || '')
          : (productIds.value?.premiumPro.prod || '')
      } else if (plan === 'premium_plus') {
        productId = isTestMode.value
          ? (productIds.value?.premiumPlus.test || '')
          : (productIds.value?.premiumPlus.prod || '')
      } else {
        productId = isTestMode.value
          ? (productIds.value?.premium.test || '')
          : (productIds.value?.premium.prod || '')
      }

      if (!productId) {
        throw new Error('Product ID not configured')
      }

      const response = await subscriptionClient.post('/checkouts', {
        productId: productId,
        successUrl: `${window.location.origin}/pricing?success=true`,
        cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        metadata: {
          userId: user.id,
        },
      })

      // Save checkout ID to localStorage (for post-payment sync)
      if (response.data.checkoutId) {
        localStorage.setItem('pending_checkout_id', response.data.checkoutId)
        localStorage.setItem('pending_checkout_user_id', user.id)
      }

      // Redirect to checkout page
      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl
      } else {
        throw new Error('Unable to create checkout session')
      }
    } catch (err: any) {
      console.error('Failed to create checkout:', err)
      error.value = err.response?.data?.error || err.message || 'Failed to create checkout session'
      isLoading.value = false
    }
  }
}

// 从 checkout 同步订阅状态
const syncSubscriptionFromCheckout = async (checkoutId: string, userId: string) => {
  try {
    console.log(`🔄 Attempting to sync subscription from checkout: ${checkoutId}`)
    const response = await subscriptionClient.post('/subscription/sync-from-checkout', {
      checkoutId,
      userId,
    })
    
    if (response.data.success) {
      console.log('✅ Subscription synced successfully')
      return true
    }
    return false
  } catch (err: any) {
    console.warn('Failed to sync subscription from checkout:', err)
    return false
  }
}

// 轮询订阅状态直到更新成功
const pollSubscriptionStatus = async (maxAttempts = 10, intervalMs = 2000) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const session = await supabase.auth.getSession()
      const response = await subscriptionClient.get('/subscription/status', {
        params: { user_id: user.id },
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token || user.id}`,
        },
      })
      
      const info = response.data
      // 检查是否已升级为高级版、Premium Plus或Premium Pro
      if (info.planName === 'Premium' || info.planName === 'premium' || 
          info.planName === 'Premium Plus' || info.planName === 'premium_plus' ||
          info.planName === 'Premium Pro' || info.planName === 'premium_pro') {
        subscriptionInfo.value = info
        return true
      }
      
      // 如果还没更新，等待后重试
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    } catch (err) {
      console.warn(`Polling attempt ${attempt + 1} failed:`, err)
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    }
  }
  return false
}

// 检查 URL 参数（支付成功/取消）
onMounted(async () => {
  if (typeof window === 'undefined') return

  // 首先加载后端配置
  await loadConfig()

  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('success') === 'true') {
    // Payment succeeded; wait for subscription status to update
    isLoading.value = true
    
    // 获取保存的 checkout ID
    const checkoutId = localStorage.getItem('pending_checkout_id')
    const savedUserId = localStorage.getItem('pending_checkout_user_id')
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || savedUserId
    
    console.log('Payment success - checking for pending checkout:', { checkoutId, userId })
    
    // 立即加载一次
    await loadSubscriptionInfo()
    
    // 如果有 checkout ID，先尝试同步
    if (checkoutId && userId) {
      console.log('🔄 Attempting to sync subscription from checkout...')
      const synced = await syncSubscriptionFromCheckout(checkoutId, userId)
      if (synced) {
        await loadSubscriptionInfo()
        alert('Subscription activated! Premium features are now available.')
        isLoading.value = false
        window.history.replaceState({}, '', '/pricing')
        return
      }
    }
    
    // If sync failed, poll for status (up to ~20s)
    alert('Payment successful. Confirming subscription status...')
    const updated = await pollSubscriptionStatus(10, 2000)
    
    if (updated) {
    alert('Subscription activated! Premium features are now available.')
      // 清除保存的数据
      if (checkoutId) localStorage.removeItem('pending_checkout_id')
      if (savedUserId) localStorage.removeItem('pending_checkout_user_id')
    } else {
      alert('Payment succeeded but the subscription may take time to update. If it does not update soon, please refresh or contact support.')
    }
    
    isLoading.value = false
    // 清除 URL 参数
    window.history.replaceState({}, '', '/pricing')
  } else if (urlParams.get('canceled') === 'true') {
    // Clear saved data
    localStorage.removeItem('pending_checkout_id')
    localStorage.removeItem('pending_checkout_user_id')
    error.value = 'Payment was canceled'
    window.history.replaceState({}, '', '/pricing')
  }

  await loadSubscriptionInfo()
})
</script>
