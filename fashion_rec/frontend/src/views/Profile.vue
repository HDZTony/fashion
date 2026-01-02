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
// 从后端获取环境配置
const isTestMode = ref(false)
const productIds = ref<{
  premium: { test: string; prod: string }
  premiumPlus: { test: string; prod: string }
  premiumPro: { test: string; prod: string }
} | null>(null)
// 从后端获取的计划数据
const plansData = ref<Array<{
  slug: string
  name: string
  price: string
  tries: string
  desc: string
}>>([])


// 从后端加载环境配置（完全依赖后端，无环境变量后备）
const loadConfig = async () => {
  try {
    const response = await subscriptionClient.get('/config')
    isTestMode.value = response.data.isTestMode
    productIds.value = response.data.productIds
    
    console.log('Raw config response from backend:', response.data)
    
    // 验证配置是否完整
    if (!productIds.value) {
      throw new Error('Backend returned empty productIds configuration.')
    }
    
    // 验证每个套餐的产品 ID 是否都存在
    const missingIds: string[] = []
    
    if (!productIds.value.premium?.test) missingIds.push('premium.test (CREEM_TEST_PRODUCT_ID)')
    if (!productIds.value.premium?.prod) missingIds.push('premium.prod (CREEM_PROD_PRODUCT_ID)')
    if (!productIds.value.premiumPlus?.test) missingIds.push('premiumPlus.test (CREEM_TEST_PRODUCT_ID_PREMIUM_PLUS)')
    if (!productIds.value.premiumPlus?.prod) missingIds.push('premiumPlus.prod (CREEM_PROD_PRODUCT_ID_PREMIUM_PLUS)')
    if (!productIds.value.premiumPro?.test) missingIds.push('premiumPro.test (CREEM_TEST_PRODUCT_ID_PREMIUM_PRO)')
    if (!productIds.value.premiumPro?.prod) missingIds.push('premiumPro.prod (CREEM_PROD_PRODUCT_ID_PREMIUM_PRO)')
    
    if (missingIds.length > 0) {
      const errorMsg = `Backend configuration is incomplete. Missing product IDs: ${missingIds.join(', ')}. ` +
        `Please set these environment variables in the subscription-service Worker.`
      console.error('Configuration validation failed:', {
        missingIds,
        currentConfig: productIds.value,
        isTestMode: isTestMode.value,
      })
      throw new Error(errorMsg)
    }
    
    console.log('Environment config loaded from backend:', { 
      isTestMode: isTestMode.value, 
      productIds: productIds.value 
    })
  } catch (error: any) {
    console.error('Failed to load config from backend:', error)
    error.value = `无法加载订阅配置: ${error?.response?.data?.error || error?.message || 'Unknown error'}. 请确保后端服务正常运行。`
    throw error // 抛出错误，让调用者知道配置加载失败
  }
}

const planNameRaw = computed(() => subscriptionInfo.value?.planName)
const planDisplay = computed(() => {
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'premium_pro' || name === 'premium pro') return 'Premium Pro ($29.9)'
  if (name === 'premium_plus' || name === 'premium plus') return 'Premium Plus ($15)'
  if (name === 'premium') return 'Premium ($5)'
  return subscriptionInfo.value?.planName || 'Free'
})
const planSlug = computed(() => {
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'premium_pro' || name === 'premium pro') return 'premium_pro'
  if (name === 'premium_plus' || name === 'premium plus') return 'premium_plus'
  if (name === 'premium') return 'premium'
  return 'free'
})
const planRank: Record<string, number> = { free: 0, premium: 1, premium_plus: 2, premium_pro: 3 }
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


const getProductIdForPlan = async (target: 'premium' | 'premium_plus' | 'premium_pro'): Promise<string> => {
  // 确保配置已加载
  if (!productIds.value) {
    await loadConfig()
  }

  // 如果配置加载后仍然为空，抛出错误
  if (!productIds.value) {
    throw new Error('Failed to load product configuration. Please refresh the page and try again.')
  }

  // 添加调试信息
  console.log('Getting product ID for plan:', {
    target,
    isTestMode: isTestMode.value,
    availableConfig: productIds.value,
  })

  let productId: string = ''
  
  if (target === 'premium_pro') {
    productId = isTestMode.value
      ? (productIds.value.premiumPro?.test || '')
      : (productIds.value.premiumPro?.prod || '')
  } else if (target === 'premium_plus') {
    productId = isTestMode.value
      ? (productIds.value.premiumPlus?.test || '')
      : (productIds.value.premiumPlus?.prod || '')
  } else {
    productId = isTestMode.value
      ? (productIds.value.premium?.test || '')
      : (productIds.value.premium?.prod || '')
  }

  // 如果 productId 为空，抛出明确的错误，包含调试信息
  if (!productId || productId.trim() === '') {
    const env = isTestMode.value ? 'test' : 'production'
    const configKey = isTestMode.value 
      ? (target === 'premium_pro' ? 'premiumPro.test' : target === 'premium_plus' ? 'premiumPlus.test' : 'premium.test')
      : (target === 'premium_pro' ? 'premiumPro.prod' : target === 'premium_plus' ? 'premiumPlus.prod' : 'premium.prod')
    
    console.error('Product ID not found:', {
      target,
      env,
      configKey,
      availableConfig: productIds.value,
      requestedPath: target === 'premium_pro' 
        ? productIds.value.premiumPro 
        : target === 'premium_plus' 
        ? productIds.value.premiumPlus 
        : productIds.value.premium,
    })
    
    throw new Error(
      `Product ID for ${target} plan is not configured in ${env} mode. ` +
      `Please ensure the backend environment variable CREEM_${env.toUpperCase()}_PRODUCT_ID${target === 'premium_pro' ? '_PREMIUM_PRO' : target === 'premium_plus' ? '_PREMIUM_PLUS' : ''} is set.`
    )
  }

  return productId
}

// Upgrade/downgrade existing subscription
const upgradeSubscription = async (target: 'premium' | 'premium_plus' | 'premium_pro') => {
  const subscriptionId = subscriptionInfo.value?.subscriptionId || subscriptionInfo.value?.subscription_id
  try {
    isLoading.value = true
    error.value = null
    
    // Determine if this is an upgrade or downgrade
    const currentRank = planRank[planSlug.value] ?? 0
    const targetRank = planRank[target] ?? 0
    const isUpgrade = targetRank > currentRank
    
    // Use proration-none for all subscription updates (no immediate charge or credit)
    const updateBehavior = 'proration-none'
    
    // 获取 productId（函数内部会验证并抛出错误如果为空）
    const productId = await getProductIdForPlan(target)
    
    console.log('Upgrading subscription:', {
      subscriptionId,
      productId: productId ? `${productId.substring(0, 10)}...` : 'MISSING',
      target,
      updateBehavior,
      isTestMode: isTestMode.value,
    })
    
    await subscriptionClient.post(`/subscriptions/${subscriptionId}/upgrade`, {
      productId,
      updateBehavior,
    })
    // Reload subscription info after upgrade/downgrade
    await loadSubscriptionInfo()
    alert(`Subscription ${isUpgrade ? 'upgraded' : 'downgraded'} successfully!`)
  } catch (e: any) {
    console.error('Failed to upgrade/downgrade subscription', e)
    const errorMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Failed to update subscription'
    const errorDetails = e?.response?.data?.details
    
    // 构建更详细的错误信息
    let fullErrorMsg = errorMsg
    if (errorDetails) {
      if (errorDetails.currentEnvironment) {
        fullErrorMsg += `\n\nCurrent environment: ${errorDetails.currentEnvironment}`
      }
      if (errorDetails.suggestion) {
        fullErrorMsg += `\n\n${errorDetails.suggestion}`
      }
    }
    
    error.value = fullErrorMsg
    
    // If subscription not found, check if it's an environment mismatch
    if (errorMsg.includes('not found') || errorMsg.includes('does not exist') || e?.response?.status === 404) {
      const currentEnv = isTestMode.value ? 'test' : 'production'
      const oppositeEnv = isTestMode.value ? 'production' : 'test'
      const envMismatchMsg = `The subscription may have been created in the ${oppositeEnv} environment, but you're currently using the ${currentEnv} environment. Please check your CREEM_TEST_MODE setting.`
      
      alert(`${errorMsg}\n\n${envMismatchMsg}\n\nWould you like to open the customer portal to manage your subscription?`)
      const usePortal = confirm('Open customer portal?')
      if (usePortal) {
        openPortal()
      }
    } else if (errorMsg.includes('Forbidden') || e?.response?.status === 403) {
      // If Forbidden error, suggest using customer portal
      const usePortal = confirm('Direct upgrade/downgrade is not available. Would you like to manage your subscription through the customer portal?')
      if (usePortal) {
        openPortal()
      }
    }
  } finally {
    isLoading.value = false
  }
}

// Start new checkout (for users without subscription)
const startCheckout = async (target: 'premium' | 'premium_plus' | 'premium_pro') => {
  try {
    isLoading.value = true
    error.value = null
    // 优先使用 auth store 中的 user
    let user = authStore.user
    if (!user) {
      const { data: { user: fetchedUser } } = await supabase.auth.getUser()
      user = fetchedUser
    }
    if (!user) throw new Error('Please sign in first')

    const productId = await getProductIdForPlan(target)
    const response = await subscriptionClient.post('/checkouts', {
      productId,
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
    loadConfig().catch((err) => {
      // 配置加载失败，显示错误但继续加载其他数据
      console.error('Failed to load config, subscription management features may be unavailable:', err)
      isLoading.value = false
    }),
    loadPlans(),
    loadSubscriptionInfo()
  ])
}

// 根据计划 slug 和用户状态生成 action 函数
const getPlanAction = (targetSlug: string): () => void => {
  const currentSlug = planSlug.value
  const currentStatus = status.value
  const isCurrentPlanActive = currentSlug !== 'free' && (currentStatus === 'Active' || currentStatus === 'Trialing')
  const isCanceledOrExpired = currentStatus === 'Canceled' || currentStatus === 'Expired'
  
  // Free 计划：始终执行取消订阅（降级到免费）
  if (targetSlug === 'free') {
    return () => cancelSubscription()
  }
  
  // 付费计划：根据当前状态决定操作
  if (targetSlug === currentSlug && isCurrentPlanActive) {
    // 当前计划且激活：取消订阅
    return () => cancelSubscription()
  } else if (isCanceledOrExpired || currentSlug === 'free') {
    // 已取消/过期或当前是免费：开始新订阅
    return () => startCheckout(targetSlug as 'premium' | 'premium_plus' | 'premium_pro')
  } else {
    // 其他情况：升级/降级订阅
    return () => upgradeSubscription(targetSlug as 'premium' | 'premium_plus' | 'premium_pro')
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

        <!-- Plans -->
        <div class="bg-white rounded-2xl border border-green-100 shadow-sm p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-green-800">Plans</h2>
            <span class="text-sm text-green-600">Upgrade or downgrade</span>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
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
      </div>
    </main>
  </div>
</template>

