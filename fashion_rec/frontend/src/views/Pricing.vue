<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Navigation Bar -->
      <header class="mb-8 flex items-center justify-between">
        <router-link to="/" class="text-3xl font-bold tracking-tight hover:opacity-80 transition-opacity">
          Fashion AI Wardrobe
        </router-link>
        <nav class="flex items-center gap-4">
          <router-link
            to="/wardrobe"
            class="text-sm text-gray-500 hover:text-black underline transition-colors"
            active-class="text-black font-medium"
          >
            My Wardrobe
          </router-link>
          <router-link
            to="/history"
            class="text-sm text-gray-500 hover:text-black underline transition-colors"
            active-class="text-black font-medium"
          >
            My Outfit History
          </router-link>
          <router-link
            to="/favorites"
            class="text-sm text-gray-500 hover:text-black underline flex items-center gap-1 transition-colors"
            active-class="text-black font-medium"
          >
            <Heart class="w-4 h-4" />
            Favorites
          </router-link>
          <router-link
            to="/tryon-history"
            class="text-sm text-gray-500 hover:text-black underline flex items-center gap-1 transition-colors"
            active-class="text-black font-medium"
          >
            <History class="w-4 h-4" />
            Try-On History
          </router-link>
          <router-link
            to="/pricing"
            class="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors"
            active-class="text-blue-700"
          >
            💎 Pricing
          </router-link>
          <button @click="logout" class="text-sm text-gray-500 hover:text-black flex items-center gap-1 transition-colors">
            <LogOut class="w-4 h-4" />
            Sign Out
          </button>
        </nav>
      </header>

      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">选择适合您的方案</h1>
        <p class="text-lg text-gray-600">解锁更多虚拟试穿功能</p>
      </div>

      <!-- Pricing Cards -->
      <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <!-- Free Plan -->
        <div class="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 hover:border-blue-500 transition-all">
          <div class="text-center">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">免费版</h2>
            <div class="mb-6">
              <span class="text-5xl font-bold text-gray-900">$0</span>
              <span class="text-gray-600 ml-2">/月</span>
            </div>
            <ul class="text-left space-y-4 mb-8">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-gray-700">每天 1 次虚拟试穿</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-gray-700">基础功能访问</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-gray-700">历史记录保存</span>
              </li>
            </ul>
            <button
              @click="selectPlan('free')"
              :disabled="isCurrentPlan === 'free'"
              :class="[
                'w-full py-3 px-6 rounded-lg font-semibold transition-all',
                isCurrentPlan === 'free'
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              ]"
            >
              {{ isCurrentPlan === 'free' ? '当前方案' : '继续使用免费版' }}
            </button>
          </div>
        </div>

        <!-- Premium Plan -->
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl border-2 border-blue-500 p-8 text-white relative transform hover:scale-105 transition-all">
          <!-- Popular Badge -->
          <div class="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <span class="bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold">推荐</span>
          </div>
          
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-2">高级版</h2>
            <div class="mb-6">
              <span class="text-5xl font-bold">$5</span>
              <span class="text-blue-100 ml-2">/月</span>
            </div>
            <ul class="text-left space-y-4 mb-8">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>每月 150 次虚拟试穿</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>所有高级功能</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>优先处理</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-yellow-300 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>无限历史记录</span>
              </li>
            </ul>
            <button
              @click="selectPlan('premium')"
              :disabled="isLoading || isCurrentPlan === 'premium'"
              :class="[
                'w-full py-3 px-6 rounded-lg font-semibold transition-all',
                isCurrentPlan === 'premium'
                  ? 'bg-white/20 text-white/70 cursor-not-allowed'
                  : isLoading
                  ? 'bg-white/80 text-blue-600 cursor-wait'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              ]"
            >
              {{ isLoading ? '处理中...' : isCurrentPlan === 'premium' ? '当前方案' : '立即订阅' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Current Plan Info -->
      <div v-if="subscriptionInfo" class="mt-12 max-w-4xl mx-auto">
        <div class="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">当前订阅信息</h3>
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-600">方案</p>
              <p 
                :class="[
                  'text-lg font-semibold',
                  (subscriptionInfo.status === 'canceled' || subscriptionInfo.status === 'expired') && subscriptionInfo.planName === '高级版'
                    ? 'text-gray-500 line-through'
                    : 'text-gray-900'
                ]"
              >
                {{ subscriptionInfo.planName }}
                <span 
                  v-if="subscriptionInfo.status === 'canceled' || subscriptionInfo.status === 'expired'"
                  class="ml-2 text-sm text-red-600"
                >
                  (已取消)
                </span>
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-600">剩余试穿次数</p>
              <p class="text-lg font-semibold text-gray-900">
                {{ subscriptionInfo.remainingTries }}/{{ subscriptionInfo.totalTries }}
              </p>
            </div>
            <div v-if="subscriptionInfo.nextResetDate">
              <p class="text-sm text-gray-600">下次重置时间</p>
              <p class="text-lg font-semibold text-gray-900">{{ subscriptionInfo.nextResetDate }}</p>
            </div>
            <div v-if="subscriptionInfo.subscriptionId">
              <p class="text-sm text-gray-600">订阅状态</p>
              <p 
                :class="[
                  'text-lg font-semibold',
                  subscriptionInfo.status === 'canceled' || subscriptionInfo.status === 'expired'
                    ? 'text-red-600'
                    : subscriptionInfo.status === 'active'
                    ? 'text-green-600'
                    : 'text-gray-900'
                ]"
              >
                {{ getStatusText(subscriptionInfo.status) }}
              </p>
            </div>
          </div>
          <div v-if="subscriptionInfo.subscriptionId" class="mt-4">
            <button
              @click="openCustomerPortal"
              class="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              管理订阅 →
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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { Heart, History, LogOut } from 'lucide-vue-next'

defineOptions({ name: 'Pricing' })

const router = useRouter()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SUBSCRIPTION_API_URL = import.meta.env.VITE_SUBSCRIPTION_API_URL || 'http://localhost:3001'

// Logout function
const logout = async () => {
  try {
    await supabase.auth.signOut()
    localStorage.removeItem('auth_token')
    router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
    // Still redirect even if signOut fails
    localStorage.removeItem('auth_token')
    router.push('/login')
  }
}

const isLoading = ref(false)
const error = ref<string | null>(null)
const subscriptionInfo = ref<any>(null)
const isCurrentPlan = computed(() => {
  if (!subscriptionInfo.value) return null
  return subscriptionInfo.value.planName === '高级版' ? 'premium' : 'free'
})

// 将状态转换为中文显示
const getStatusText = (status: string | null | undefined): string => {
  if (!status) return '未知'
  const statusMap: Record<string, string> = {
    active: '活跃',
    canceled: '已取消',
    expired: '已过期',
    trialing: '试用中',
    past_due: '逾期',
    unpaid: '未支付',
  }
  return statusMap[status] || status
}

// 创建配置了认证头的 axios 实例
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 添加请求拦截器
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

// 订阅服务客户端
const subscriptionClient = axios.create({
  baseURL: SUBSCRIPTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 加载订阅信息
const loadSubscriptionInfo = async () => {
  try {
    // 获取当前用户 ID
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('请先登录')
    }

    // 直接调用 subscription-service
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
    // 如果用户没有订阅，设置为免费版
    subscriptionInfo.value = {
      planName: '免费版',
      remainingTries: 0,
      totalTries: 1,
      period: 'daily',
    }
  }
}

// 选择方案
const selectPlan = async (plan: 'free' | 'premium') => {
  if (plan === 'free') {
    // 免费版不需要支付
    router.push('/')
    return
  }

  if (plan === 'premium') {
    isLoading.value = true
    error.value = null

    try {
      // 获取当前用户信息
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('请先登录')
      }

      // 创建结账会话
      const productId = import.meta.env.VITE_CREEM_PRODUCT_ID
      const response = await subscriptionClient.post('/checkouts', {
        productId: productId,
        successUrl: `${window.location.origin}/pricing?success=true`,
        cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        metadata: {
          userId: user.id,
        },
      })

      // 保存 checkout ID 到 localStorage（用于支付成功后同步）
      if (response.data.checkoutId) {
        localStorage.setItem('pending_checkout_id', response.data.checkoutId)
        localStorage.setItem('pending_checkout_user_id', user.id)
      }

      // 重定向到支付页面
      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl
      } else {
        throw new Error('无法创建支付会话')
      }
    } catch (err: any) {
      console.error('Failed to create checkout:', err)
      error.value = err.response?.data?.error || err.message || '创建支付会话失败'
      isLoading.value = false
    }
  }
}

// 打开客户门户
const openCustomerPortal = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('请先登录')
    }

    // 获取客户 ID（需要从订阅信息中获取）
    const customerId = subscriptionInfo.value?.customerId
    if (!customerId) {
      throw new Error('无法找到客户信息')
    }

    const response = await subscriptionClient.post(`/customers/${customerId}/portal`, {
      returnUrl: window.location.href,
    })

    if (response.data.portalUrl) {
      window.location.href = response.data.portalUrl
    }
  } catch (err: any) {
    console.error('Failed to open customer portal:', err)
    error.value = err.response?.data?.error || err.message || '无法打开客户门户'
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
      // 检查是否已升级为高级版
      if (info.planName === '高级版' || info.planName === 'premium') {
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
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('success') === 'true') {
    // 支付成功，等待订阅状态更新
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
        alert('订阅成功！您现在可以使用高级功能了。')
        isLoading.value = false
        window.history.replaceState({}, '', '/pricing')
        return
      }
    }
    
    // 如果同步失败，尝试轮询（最多等待 20 秒）
    alert('支付成功！正在确认订阅状态...')
    const updated = await pollSubscriptionStatus(10, 2000)
    
    if (updated) {
    alert('订阅成功！您现在可以使用高级功能了。')
      // 清除保存的数据
      if (checkoutId) localStorage.removeItem('pending_checkout_id')
      if (savedUserId) localStorage.removeItem('pending_checkout_user_id')
    } else {
      alert('支付已成功，但订阅状态可能需要一些时间更新。如果稍后仍未更新，请刷新页面或联系我们。')
    }
    
    isLoading.value = false
    // 清除 URL 参数
    window.history.replaceState({}, '', '/pricing')
  } else if (urlParams.get('canceled') === 'true') {
    // 清除保存的数据
    localStorage.removeItem('pending_checkout_id')
    localStorage.removeItem('pending_checkout_user_id')
    error.value = '支付已取消'
    window.history.replaceState({}, '', '/pricing')
  }

  await loadSubscriptionInfo()
})
</script>
