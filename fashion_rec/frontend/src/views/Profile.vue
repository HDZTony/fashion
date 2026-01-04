<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { subscriptionClient } from '../lib/api-client'
import { useAuthStore } from '../stores/auth'

defineOptions({ name: 'Profile' })

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(false)
const error = ref<string | null>(null)
const subscriptionInfo = ref<any>(null)
const userEmail = ref<string>('—')
// 从后端获取的计划数据
const plansData = ref<Array<{
  slug: string
  name: string
  price: string
  tries: string
  desc: string
}>>([])
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


// 从后端加载 credits 商品数据
const loadCredits = async () => {
  try {
    const response = await subscriptionClient.get('/credits')
    creditsData.value = response.data.credits || []
  } catch (e: any) {
    console.error('Failed to load credits:', e)
  }
}

const planNameRaw = computed(() => subscriptionInfo.value?.planName)
const planDisplay = computed(() => {
  // 如果订阅状态是 Canceled 或 Expired，显示 Free
  const currentStatus = subscriptionInfo.value?.status?.toLowerCase()
  if (currentStatus === 'canceled' || currentStatus === 'expired') {
    return 'Free'
  }
  
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'member' || name === 'fashion rec member') {
    return 'Fashion Rec Member ($4.9)'
  }
  return subscriptionInfo.value?.planName || 'Free'
})
const planSlug = computed(() => {
  // 如果订阅状态是 Canceled 或 Expired，返回 free
  const currentStatus = subscriptionInfo.value?.status?.toLowerCase()
  if (currentStatus === 'canceled' || currentStatus === 'expired') {
    return 'free'
  }
  
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'member' || name === 'fashion rec member') return 'member'
  return 'free'
})
const planRank: Record<string, number> = { free: 0, member: 1 }
const remainingTries = computed(() => subscriptionInfo.value?.remainingTries ?? 0)
const freeRemainingTries = computed(() => {
  // 使用后端返回的 dailyFreeTriesRemaining 字段（所有计划都有每天3次免费机会）
  // 如果后端没有返回，默认显示3（如果还没有使用过）
  return subscriptionInfo.value?.dailyFreeTriesRemaining ?? 0
})
const nextResetDate = computed(() => {
  const dateStr = subscriptionInfo.value?.nextResetDate
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return dateStr
  }
})
const status = computed(() => getStatusText(subscriptionInfo.value?.status))

const getStatusText = (status: string | null | undefined): string => {
  if (!status) return 'Unknown'
  const statusMap: Record<string, string> = {
    active: 'Active',
    canceled: 'Canceled',
    expired: 'Expired',
    trialing: 'Trialing',
    past_due: 'Past Due',
    unpaid: 'Unpaid',
  }
  return statusMap[status] || status
}

// 防止重复调用的标志
let isLoadingSubscriptionInfo = false
const loadSubscriptionInfo = async () => {
  // 防止重复调用（特别是在开发环境的热重载场景下）
  if (isLoadingSubscriptionInfo) {
    console.log('🔄 Subscription info already loading, skipping...')
    return
  }
  
  isLoadingSubscriptionInfo = true
  isLoading.value = true
  error.value = null
  try {
    // 优先使用 auth store 中的 user，避免重复调用 getUser()
    let user = authStore.user
    if (!user) {
      // 如果 store 中没有 user，才调用 getUser()
      const { data: { user: fetchedUser } } = await supabase.auth.getUser()
      user = fetchedUser
    }
    
    if (!user) throw new Error('Please sign in first')
    userEmail.value = user.email || '—'

    const response = await subscriptionClient.get('/subscription/status', {
      params: { user_id: user.id },
    })
    subscriptionInfo.value = response.data
  } catch (e: any) {
    console.error('Failed to load subscription info:', e)
    error.value = e?.response?.data?.error || e?.message || 'Failed to load subscription info'
    subscriptionInfo.value = {
      planName: 'Free',
      remainingTries: 0,
      totalTries: 1,
      period: 'daily',
      status: 'free',
    }
  } finally {
    isLoading.value = false
    isLoadingSubscriptionInfo = false
  }
}

const goPricing = () => router.push('/pricing')
const signOut = async () => {
  try {
    await supabase.auth.signOut()
    router.push('/login')
  } catch (e) {
    console.error('Failed to sign out', e)
  }
}

// 记录打开门户的时间，用于检测用户是否从门户返回
let portalOpenedTime = 0

// Manage subscription portal
// 注意：Creem 的客户门户不支持 returnUrl 参数
// 因此我们使用页面可见性和焦点监听来检测用户返回
const openPortal = async () => {
  const customerId = subscriptionInfo.value?.customerId || subscriptionInfo.value?.customer_id
  if (!customerId) {
    goPricing()
    return
  }
  try {
    // 记录打开门户的时间戳
    portalOpenedTime = Date.now()
    console.log('🚪 Opening customer portal, timestamp:', portalOpenedTime)
    
    // 注意：Creem SDK 的 createPortal 不支持 returnUrl 参数
    // 虽然我们传递了 returnUrl，但 Creem API 可能不会使用它
    const returnUrl = `${window.location.origin}/profile?from=portal`
    const resp = await subscriptionClient.post(`/customers/${customerId}/portal`, {
      returnUrl, // 即使 Creem 不支持，我们也传递它，以防将来支持
    })
    const url = resp.data?.portalUrl
    if (url) {
      window.location.href = url
    } else {
      goPricing()
    }
  } catch (e) {
    console.error('Failed to open portal', e)
    portalOpenedTime = 0 // 打开失败，重置时间戳
    goPricing()
  }
}


// Upgrade/downgrade existing subscription (only supports member now)
const upgradeSubscription = async (target: 'member') => {
  const subscriptionId = subscriptionInfo.value?.subscriptionId || subscriptionInfo.value?.subscription_id
  if (!subscriptionId) {
    error.value = 'No active subscription found'
    return
  }
  
  try {
    isLoading.value = true
    error.value = null
    
    // Get product ID from plans data (should be loaded from backend)
    const plan = plansData.value.find((p: any) => p.slug === target)
    if (!plan || !(plan as any).productId) {
      throw new Error('Plan not found. Please refresh the page.')
    }
    
    const updateBehavior = 'proration-none'
    
    await subscriptionClient.post(`/subscriptions/${subscriptionId}/upgrade`, {
      productId: (plan as any).productId,
      updateBehavior,
    })
    
    await loadSubscriptionInfo()
    alert('Subscription updated successfully!')
  } catch (e: any) {
    console.error('Failed to upgrade/downgrade subscription', e)
    const errorMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to update subscription'
    error.value = errorMsg
    
    if (errorMsg.includes('Forbidden') || e?.response?.status === 403) {
      const usePortal = confirm('Direct upgrade/downgrade is not available. Would you like to manage your subscription through the customer portal?')
      if (usePortal) {
        openPortal()
      }
    }
  } finally {
    isLoading.value = false
  }
}

// Start new checkout for subscription plan
const startCheckout = async (target: 'member') => {
  try {
    isLoading.value = true
    error.value = null
    let user = authStore.user
    if (!user) {
      const { data: { user: fetchedUser } } = await supabase.auth.getUser()
      user = fetchedUser
    }
    if (!user) throw new Error('Please sign in first')

    // Get product ID from plans data (should be loaded from backend)
    const plan = plansData.value.find((p: any) => p.slug === target)
    if (!plan || !(plan as any).productId) {
      throw new Error('Plan not found. Please refresh the page.')
    }

    const response = await subscriptionClient.post('/checkouts', {
      productId: (plan as any).productId,
      successUrl: `${window.location.origin}/pricing?success=true`,
      cancelUrl: `${window.location.origin}/pricing?canceled=true`,
    })
    if (response.data.checkoutUrl) {
      window.location.href = response.data.checkoutUrl
    } else {
      throw new Error('Unable to create checkout session')
    }
  } catch (e: any) {
    console.error('Failed to start checkout', e)
    error.value = e?.response?.data?.error || e?.message || 'Failed to start checkout'
  } finally {
    isLoading.value = false
  }
}

// Start checkout for credits (one-time purchase)
const purchaseCredits = async (creditProductId: string) => {
  try {
    isLoading.value = true
    error.value = null
    let user = authStore.user
    if (!user) {
      const { data: { user: fetchedUser } } = await supabase.auth.getUser()
      user = fetchedUser
    }
    if (!user) throw new Error('Please sign in first')

    const response = await subscriptionClient.post('/checkouts', {
      productId: creditProductId,
      successUrl: `${window.location.origin}/profile?success=credits`,
      cancelUrl: `${window.location.origin}/profile?canceled=credits`,
    })
    if (response.data.checkoutUrl) {
      window.location.href = response.data.checkoutUrl
    } else {
      throw new Error('Unable to create checkout session')
    }
  } catch (e: any) {
    console.error('Failed to purchase credits', e)
    error.value = e?.response?.data?.error || e?.message || 'Failed to purchase credits'
  } finally {
    isLoading.value = false
  }
}

const cancelSubscription = async () => {
  const subscriptionId = subscriptionInfo.value?.subscriptionId || subscriptionInfo.value?.subscription_id
  try {
    isLoading.value = true
    await subscriptionClient.post(`/subscriptions/${subscriptionId}/cancel`)
    await loadSubscriptionInfo()
  } catch (e) {
    console.error('Failed to cancel subscription', e)
  } finally {
    isLoading.value = false
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

// 初始化所有数据（合并配置和计划数据的加载）
const initializeData = async () => {
  await Promise.all([
    loadPlans(),
    loadCredits(),
    loadSubscriptionInfo()
  ])
}

// 根据计划 slug 和用户状态生成 action 函数
const getPlanAction = (targetSlug: string): () => void => {
  const currentSlug = planSlug.value
  const currentStatus = status.value
  const isCurrentPlanActive = currentSlug !== 'free' && (currentStatus === 'Active' || currentStatus === 'Trialing')
  const isCanceledOrExpired = currentStatus === 'Canceled' || currentStatus === 'Expired'
  
  // 付费计划：根据当前状态决定操作
  if (targetSlug === currentSlug && isCurrentPlanActive) {
    // 当前计划且激活：取消订阅
    return () => cancelSubscription()
  } else if (isCanceledOrExpired || currentSlug === 'free') {
    // 已取消/过期或当前是免费：开始新订阅
    return () => startCheckout(targetSlug as 'member')
  } else {
    // 其他情况：升级/降级订阅
    return () => upgradeSubscription(targetSlug as 'member')
  }
}

const plans = computed(() => {
  // 如果计划数据还未加载，返回空数组
  if (plansData.value.length === 0) {
    return []
  }
  
  // 为每个计划添加 action 函数
  return plansData.value.map((plan) => ({
    ...plan,
    action: getPlanAction(plan.slug),
  }))
})

const actionLabel = (slug: string) => {
  if (slug === planSlug.value) {
    // 当前计划：如果是付费计划且状态为 active/trialing，显示取消订阅
    if (planSlug.value !== 'free' && (status.value === 'Active' || status.value === 'Trialing')) {
      return 'Cancel Subscription'
    }
    return 'Current plan'
  }
  // 如果当前订阅状态是 Canceled 或 Expired，其他套餐显示 "Subscribe"
  if (status.value === 'Canceled' || status.value === 'Expired') {
    return 'Subscribe'
  }
  const currentRank = planRank[planSlug.value] ?? 0
  const targetRank = planRank[slug] ?? 0
  return targetRank > currentRank ? 'Upgrade' : 'Downgrade'
}

const isActionDisabled = (slug: string) => {
  // 如果是当前计划，且是付费计划且状态为 active/trialing，不禁用（允许取消订阅）
  if (slug === planSlug.value) {
    if (planSlug.value !== 'free' && (status.value === 'Active' || status.value === 'Trialing')) {
      return isLoading.value // 只在加载时禁用
    }
    return true // 其他情况禁用
  }
  return isLoading.value
}

onMounted(async () => {
  // 初始化所有数据（配置、计划、订阅信息）
  await initializeData()
  
  // 检查是否从客户门户返回（通过 URL 参数）
  // 注意：不再自动同步，用户需要手动刷新或点击按钮来更新状态
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('from') === 'portal') {
    // 从门户返回，清理 URL 参数
    console.log('🔄 Detected return from portal via URL parameter')
    window.history.replaceState({}, '', '/profile')
    // 不再自动同步，避免轮询
  }
  
})
</script>

<template>
  <div class="min-h-screen bg-green-50/20">
    <main class="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 class="text-3xl font-bold text-green-800">Profile</h1>
          <p class="text-green-700 mt-2">View your subscription status and remaining tries</p>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-green-800">Subscription</h2>
              <span class="text-sm text-green-600">{{ isLoading ? 'Loading...' : 'Updated' }}</span>
            </div>
            <div class="space-y-3">
              <div class="flex justify-between text-sm text-green-700">
                <span>Current plan</span>
                <span class="font-semibold text-green-900">{{ planDisplay }}</span>
              </div>
              <div class="flex justify-between text-sm text-green-700">
                <span>Status</span>
                <span class="font-semibold text-green-900">{{ status }}</span>
              </div>
              <div class="flex justify-between text-sm text-green-700">
                <span>Remaining free tries</span>
                <span class="font-semibold text-green-900">
                  {{ freeRemainingTries }}/3 (Daily limit)
                </span>
              </div>
              <div class="flex justify-between text-sm text-green-700" v-if="planSlug !== 'free'">
                <span>Remaining paid tries</span>
                <span class="font-semibold text-green-900">{{ remainingTries }}</span>
              </div>
              <div class="flex justify-between text-sm text-green-700" v-else>
                <span>Remaining tries</span>
                <span class="font-semibold text-green-900">{{ remainingTries }}</span>
              </div>
              <div class="flex justify-between text-sm text-green-700" v-if="nextResetDate">
                <span>Next reset</span>
                <span class="font-semibold text-green-900">{{ nextResetDate }}</span>
              </div>
            </div>
            <!-- 退订按钮：只在付费计划且状态为 active/trialing 时显示 -->
            <div v-if="planSlug !== 'free' && (status === 'Active' || status === 'Trialing')" class="mt-4 pt-4 border-t border-green-200">
              <Button 
                variant="outline" 
                class="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                :disabled="isLoading"
                @click="cancelSubscription"
              >
              Cancel Subscription
              </Button>
            </div>
            <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
          </div>

          <div class="bg-white rounded-2xl border border-green-100 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-green-800">Account</h2>
            </div>
            <div class="space-y-3 text-sm text-green-700">
              <p>Sign-in email: <span class="font-semibold">{{ userEmail }}</span></p>
              <p>Billing period: <span class="font-semibold">{{ subscriptionInfo?.period || 'daily' }}</span></p>
            </div>
            <div class="mt-6 space-y-3">
              <Button variant="outline" class="w-full" @click="openPortal">Customer Portal</Button>
              <Button variant="secondary" class="w-full" @click="signOut">Sign out</Button>
            </div>
          </div>
        </div>

        <!-- Subscription Plans -->
        <div class="bg-white rounded-2xl border border-green-100 shadow-sm p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-green-800">Subscription Plans</h2>
            <span class="text-sm text-green-600">Monthly recurring</span>
          </div>
          <div class="grid gap-4 md:grid-cols-1">
            <div
              v-for="plan in plans"
              :key="plan.slug"
              class="border rounded-xl p-4 space-y-3"
              :class="plan.slug === planSlug ? 'border-green-500 bg-green-50/50' : 'border-green-200'"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold text-green-900">{{ plan.name }}</p>
                  <p class="text-sm text-green-600">{{ plan.price }}</p>
                </div>
                <span
                  v-if="plan.slug === planSlug"
                  class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700"
                >Current</span>
              </div>
              <p class="text-sm text-green-700">Includes: {{ plan.tries }}</p>
              <p class="text-sm text-green-600">{{ plan.desc }}</p>
              <Button
                class="w-full"
                :class="plan.slug === planSlug && planSlug !== 'free' && (status === 'Active' || status === 'Trialing') 
                  ? 'text-red-600 hover:text-red-700 hover:bg-red-50' 
                  : ''"
                :variant="plan.slug === planSlug ? 'outline' : 'default'"
                :disabled="isActionDisabled(plan.slug)"
                @click="plan.action()"
              >
                {{ actionLabel(plan.slug) }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Credits (One-time Purchase) -->
        <div class="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-blue-800">Credits</h2>
            <span class="text-sm text-blue-600">One-time purchase</span>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="credit in creditsData"
              :key="credit.id"
              class="border rounded-xl p-4 space-y-3 border-blue-200 hover:border-blue-400 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <p class="font-semibold text-blue-900">{{ credit.name }}</p>
                  <div v-if="getCreditDiscountInfo(credit)" class="flex items-center gap-2 mt-1">
                    <span class="text-xs line-through text-gray-400">${{ getCreditDiscountInfo(credit)!.originalPrice.toFixed(2) }}</span>
                    <span class="text-sm font-bold text-blue-600">${{ credit.price.toFixed(2) }}</span>
                    <span class="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded">-{{ ((1 - getCreditDiscountInfo(credit)!.discount) * 100).toFixed(0) }}%</span>
                  </div>
                  <p v-else class="text-sm text-blue-600">${{ credit.price.toFixed(2) }}</p>
                </div>
              </div>
              <p class="text-sm text-blue-700">{{ credit.credits }} try-ons</p>
              <p class="text-sm text-blue-600">One-time purchase, credits never expire</p>
              <Button
                class="w-full bg-blue-600 hover:bg-blue-700 text-white"
                :disabled="isLoading"
                @click="purchaseCredits(credit.id)"
              >
                {{ isLoading ? 'Processing...' : 'Purchase' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

