<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 py-12 px-4">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Choose the plan that fits you
        </h1>
        <p class="text-xl text-gray-600">Unlock more virtual try-on power</p>
      </div>

      <!-- Subscription Plan -->
      <div class="max-w-md mx-auto mb-16">
        <div
          v-for="plan in plansData"
          :key="plan.slug"
          class="bg-gradient-to-br from-pink-600 via-purple-600 to-pink-600 rounded-2xl shadow-xl border-2 border-pink-300 p-8 text-white relative transform hover:scale-105 hover:shadow-2xl transition-all"
        >
          <!-- Popular Badge -->
          <div class="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <span class="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">Recommended</span>
          </div>
          
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-2">{{ plan.name }}</h2>
            <div class="mb-6">
              <span class="text-5xl font-bold">{{ plan.price }}</span>
            </div>
            <ul class="text-left space-y-4 mb-8">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-pink-200 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>{{ plan.tries }}</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-pink-200 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>3 free tries per day (first 3 tries are free for all users)</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-pink-200 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Priority processing</span>
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-pink-200 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Unlimited history</span>
              </li>
            </ul>
            <button
              @click="selectPlan('member')"
              :disabled="isLoading"
              :class="[
                'w-full py-3 px-6 rounded-full font-semibold transition-all shadow-lg',
                isLoading
                  ? 'bg-white/80 text-pink-600 cursor-wait'
                  : 'bg-white text-pink-600 hover:bg-gray-50 hover:shadow-xl'
              ]"
            >
              {{ isLoading ? 'Processing...' : 'Subscribe now' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Credits (One-time Purchase) -->
      <div class="mb-12">
        <div class="text-center mb-8">
          <h2 class="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Or Purchase Credits
          </h2>
          <p class="text-xl text-gray-600">One-time purchase, credits never expire</p>
        </div>
        <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div
            v-for="credit in creditsData"
            :key="credit.id"
            class="bg-white rounded-2xl shadow-lg border-2 border-pink-200 p-8 hover:border-pink-400 hover:shadow-xl transition-all transform hover:-translate-y-2"
          >
            <div class="text-center">
              <h3 class="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">{{ credit.name }}</h3>
              <div class="mb-6 relative">
                <div v-if="getCreditDiscountInfo(credit)" class="flex flex-col items-center">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-3xl line-through text-gray-400">${{ getCreditDiscountInfo(credit)!.originalPrice.toFixed(2) }}</span>
                    <span class="text-5xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">${{ credit.price.toFixed(2) }}</span>
                    <span class="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">-{{ ((1 - getCreditDiscountInfo(credit)!.discount) * 100).toFixed(0) }}%</span>
                  </div>
                  <span class="text-sm text-blue-600 font-semibold">{{ getCreditDiscountInfo(credit)!.discountText }}</span>
                </div>
                <span v-else class="text-5xl font-bold text-blue-800">${{ credit.price.toFixed(2) }}</span>
              </div>
              <ul class="text-left space-y-4 mb-8">
                <li class="flex items-start">
                  <svg class="w-6 h-6 text-pink-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span class="text-gray-700">{{ credit.credits }} virtual try-ons</span>
                </li>
                <li class="flex items-start">
                  <svg class="w-6 h-6 text-blue-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span class="text-gray-700">One-time purchase</span>
                </li>
                <li class="flex items-start">
                  <svg class="w-6 h-6 text-pink-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span class="text-gray-700">Credits never expire</span>
                </li>
              </ul>
              <button
                @click="purchaseCredits(credit.id)"
                :disabled="isLoading"
              :class="[
                'w-full py-3 px-6 rounded-full font-semibold transition-all shadow-lg',
                isLoading
                  ? 'bg-gradient-to-r from-pink-300 to-purple-300 text-white cursor-wait'
                  : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:from-pink-700 hover:to-purple-700 hover:shadow-xl'
              ]"
              >
                {{ isLoading ? 'Processing...' : 'Purchase' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="mt-6 max-w-4xl mx-auto">
        <div class="bg-red-50 border-2 border-red-300 rounded-xl p-4 shadow-lg">
          <p class="text-red-700 font-medium">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { subscriptionClient } from '../lib/api-client'

defineOptions({ name: 'Pricing' })

const router = useRouter()

const isLoading = ref(false)
const error = ref<string | null>(null)
const subscriptionInfo = ref<any>(null)
// Credits 商品数据
const creditsData = ref<Array<{
  id: string
  name: string
  price: number
  credits: number
  currency: string
}>>([])

// 获取 credits 的原价和折扣信息
const getCreditDiscountInfo = (credit: { credits: number; price: number }) => {
  if (credit.credits === 200) {
    return {
      originalPrice: 20,
      discount: 0.9,
      discountText: '10% OFF'
    }
  } else if (credit.credits === 500) {
    return {
      originalPrice: 50,
      discount: 0.85,
      discountText: '15% OFF'
    }
  }
  return null
}
// Plans 数据（从后端动态获取）
const plansData = ref<Array<{
  slug: string
  name: string
  price: string
  tries: string
  desc: string
  productId?: string
}>>([])

// 从后端加载 credits 商品数据
const loadCredits = async () => {
  try {
    const response = await subscriptionClient.get('/credits')
    creditsData.value = response.data.credits || []
  } catch (e: any) {
    console.error('Failed to load credits:', e)
  }
}

// 从后端加载计划数据
const loadPlans = async () => {
  try {
    const response = await subscriptionClient.get('/plans')
    plansData.value = response.data.plans || []
  } catch (e: any) {
    console.error('Failed to load plans:', e)
  }
}

// Load subscription info
const loadSubscriptionInfo = async () => {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Please sign in first')
    }

    // Call subscription-service directly
    const response = await subscriptionClient.get('/userinfo', {
      params: { user_id: user.id },
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

// 检查用户是否已订阅非免费计划且状态为 active/trialing
const hasActivePaidSubscription = (): boolean => {
  if (!subscriptionInfo.value) return false
  
  const planName = (subscriptionInfo.value.planName || '').toString().toLowerCase()
  const status = (subscriptionInfo.value.status || '').toString().toLowerCase()
  
  // 检查是否为付费计划（member）
  const isPaidPlan = planName === 'member' || planName === 'fashion rec member'
  
  // 检查状态是否为 active 或 trialing
  const isActiveStatus = status === 'active' || status === 'trialing'
  
  return isPaidPlan && isActiveStatus
}

// Choose subscription plan
const selectPlan = async (plan: 'member') => {
  // 如果用户已订阅非免费计划，重定向到 Profile 页面
  if (hasActivePaidSubscription()) {
    router.push('/profile')
    return
  }

  isLoading.value = true
  error.value = null

  try {
    // 获取当前用户信息
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Please sign in first')
    }

    // 确保 plans 数据已加载
    if (plansData.value.length === 0) {
      await loadPlans()
    }

    // 从 plans 数据中获取 productId
    const planData = plansData.value.find((p: any) => p.slug === plan)
    if (!planData || !planData.productId) {
      throw new Error('Plan not found. Please refresh the page.')
    }

    const response = await subscriptionClient.post('/checkouts', {
      productId: planData.productId,
      successUrl: `${window.location.origin}/pricing?success=true`,
      cancelUrl: `${window.location.origin}/pricing?canceled=true`,
    })

    // Save checkout ID to localStorage (for post-payment sync)
    if (response.data.checkoutId) {
      localStorage.setItem('pending_checkout_id', response.data.checkoutId)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        localStorage.setItem('pending_checkout_user_id', user.id)
      }
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

// Purchase credits (one-time purchase)
const purchaseCredits = async (creditProductId: string) => {
  isLoading.value = true
  error.value = null

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Please sign in first')
    }

    const response = await subscriptionClient.post('/checkouts', {
      productId: creditProductId,
      successUrl: `${window.location.origin}/pricing?success=credits`,
      cancelUrl: `${window.location.origin}/pricing?canceled=credits`,
    })

    if (response.data.checkoutUrl) {
      window.location.href = response.data.checkoutUrl
    } else {
      throw new Error('Unable to create checkout session')
    }
  } catch (err: any) {
    console.error('Failed to purchase credits:', err)
    error.value = err.response?.data?.error || err.message || 'Failed to purchase credits'
    isLoading.value = false
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
const pollSubscriptionStatus = async (maxAttempts = 10, intervalMs = 2000, checkoutId?: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await subscriptionClient.get('/userinfo', {
        params: { user_id: user.id },
      })
      
      const info = response.data
      // 检查是否已升级为 member
      const planName = (info.planName || '').toString().toLowerCase()
      if (planName === 'member' || planName === 'fashion rec member') {
        subscriptionInfo.value = info
        return true
      }
      
      // 如果状态还是旧的，且还有 checkoutId，在中间尝试再次同步
      if (checkoutId && attempt === Math.floor(maxAttempts / 2)) {
        console.log('🔄 Mid-polling: Attempting to sync subscription again...')
        await syncSubscriptionFromCheckout(checkoutId, user.id)
        // 同步后立即检查一次状态
        try {
          const syncResponse = await subscriptionClient.get('/userinfo', {
            params: { user_id: user.id },
          })
          const syncInfo = syncResponse.data
          const syncPlanName = (syncInfo.planName || '').toString().toLowerCase()
          if (syncPlanName === 'member' || syncPlanName === 'fashion rec member') {
            subscriptionInfo.value = syncInfo
            return true
          }
        } catch (syncErr) {
          console.warn('Sync check failed:', syncErr)
        }
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

  // 加载数据
  await Promise.all([
    loadPlans(),
    loadCredits(),
    loadSubscriptionInfo()
  ])

  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('success') === 'true' || urlParams.get('success') === 'credits') {
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
    
    // 如果是 credits 购买，不需要同步订阅
    if (urlParams.get('success') === 'credits') {
      alert('Credits purchased successfully!')
      isLoading.value = false
      if (checkoutId) localStorage.removeItem('pending_checkout_id')
      if (savedUserId) localStorage.removeItem('pending_checkout_user_id')
      window.history.replaceState({}, '', '/pricing')
      return
    }
    
    // 如果有 checkout ID，先尝试同步（仅限订阅）
    if (checkoutId && userId) {
      console.log('🔄 Attempting to sync subscription from checkout...')
      const synced = await syncSubscriptionFromCheckout(checkoutId, userId)
      if (synced) {
        await loadSubscriptionInfo()
        alert('Subscription activated! Member features are now available.')
        isLoading.value = false
        window.history.replaceState({}, '', '/pricing')
        return
      }
    }
    
    // If sync failed, poll for status (up to ~20s)
    alert('Payment successful. Confirming subscription status...')
    const updated = await pollSubscriptionStatus(10, 2000, checkoutId || undefined)
    
    if (updated) {
      alert('Subscription activated! Member features are now available.')
      // 清除保存的数据
      if (checkoutId) localStorage.removeItem('pending_checkout_id')
      if (savedUserId) localStorage.removeItem('pending_checkout_user_id')
    } else {
      alert('Payment succeeded but the subscription may take time to update. If it does not update soon, please refresh or contact support.')
    }
    
    isLoading.value = false
    // 清除 URL 参数
    window.history.replaceState({}, '', '/pricing')
  } else if (urlParams.get('canceled') === 'true' || urlParams.get('canceled') === 'credits') {
    // Clear saved data
    localStorage.removeItem('pending_checkout_id')
    localStorage.removeItem('pending_checkout_user_id')
    error.value = 'Payment was canceled'
    window.history.replaceState({}, '', '/pricing')
  }
})
</script>
