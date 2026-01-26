<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { subscriptionClient, apiClient } from '../lib/api-client'
import { useAuthStore } from '../stores/auth'
import { useStudioStore } from '../stores/studio'
import type { UserInfo } from '../types'

defineOptions({ name: 'Profile' })

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const studioStore = useStudioStore()

// Current active tab
const activeTab = ref<'account' | 'seo'>('account')

// Account-related state
const isLoading = ref(false)
const error = ref<string | null>(null)
const userinfo = ref<UserInfo | null>(null)
const userEmail = ref<string>('—')
const plansData = ref<Array<{
  slug: string
  name: string
  price: string
  tries: string
  desc: string
}>>([])
const creditsData = ref<Array<{
  id: string
  name: string
  price: number
  credits: number
  currency: string
}>>([])

// SEO-related state
const isConnected = ref(false)
const isVerifying = ref(false)
const isSubmittingSitemap = ref(false)
const isInspecting = ref(false)
const isLoadingAnalytics = ref(false)
const siteUrl = ref('https://fashion-rec.com')
const sitemapUrl = ref('https://fashion-rec.com/sitemap.xml')
const inspectionUrl = ref('')
const verificationStatus = ref<{ success: boolean; message: string } | null>(null)
const sitemapStatus = ref<{ success: boolean; message: string } | null>(null)
const inspectionResult = ref<any>(null)
const analyticsData = ref<any>(null)
const dateRange = ref({
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0],
})

// Account functions
const getCreditDiscountInfo = (credit: { credits: number; price: number }) => {
  if (credit.credits === 800) {
    return {
      originalPrice: 20,
      discount: 0.9,
      discountText: '10% OFF'
    }
  } else if (credit.credits === 2000) {
    return {
      originalPrice: 50,
      discount: 0.85,
      discountText: '15% OFF'
    }
  }
  return null
}

const loadCredits = async () => {
  try {
    const response = await subscriptionClient.get('/credits')
    creditsData.value = response.data.credits || []
  } catch (e: any) {
    console.error('Failed to load credits:', e)
  }
}

const planNameRaw = computed(() => userinfo.value?.planName)
const planDisplay = computed(() => {
  const currentStatus = userinfo.value?.status?.toLowerCase()
  if (currentStatus === 'canceled' || currentStatus === 'expired') {
    return 'Free'
  }
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'member' || name === 'fashion rec member') {
    return 'member'
  }
  return userinfo.value?.planName
})

const planSlug = computed(() => {
  const currentStatus = userinfo.value?.status?.toLowerCase()
  if (currentStatus === 'canceled' || currentStatus === 'expired') {
    return 'free'
  }
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'member' || name === 'fashion rec member') return 'member'
  return 'free' 
})

const planRank: Record<string, number> = { free: 0, member: 1 }
const remainingCredits = computed(() => userinfo.value?.credits ?? 0)
const freeRemainingTries = computed(() => {
  return userinfo.value?.dailyFreeTriesRemaining ?? 0
})

const nextResetDate = computed(() => {
  const dateStr = userinfo.value?.nextResetDate
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

const status = computed(() => getStatusText(userinfo.value?.status))

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

let isLoadingSubscriptionInfo = false
const loadUserInfo = async () => {
  if (isLoadingSubscriptionInfo) {
    console.log('🔄 Subscription info already loading, skipping...')
    return
  }
  
  isLoadingSubscriptionInfo = true
  isLoading.value = true
  error.value = null
  try {
    let user = authStore.user
    if (!user) {
      const { data: { user: fetchedUser } } = await supabase.auth.getUser()
      user = fetchedUser
    }
    
    if (!user) throw new Error('Please sign in first')
    userEmail.value = user.email || '—'

    const response = await subscriptionClient.get('/userinfo', {
      params: { user_id: user.id },
    })
    userinfo.value = response.data
  } catch (e: any) {
    console.error('Failed to load subscription info:', e)
    error.value = e?.response?.data?.error || e?.message || 'Failed to load subscription info'
  } finally {
    isLoading.value = false
    isLoadingSubscriptionInfo = false
  }
}

const goPricing = () => router.push('/pricing')
const signOut = async () => {
  try {
    userEmail.value = '—'
    userinfo.value = null
    error.value = null
    
    // Clear Studio store state (模特图、提示词、传达建议等)
    studioStore.clearState()
    
    // Clear sessionStorage caches
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('studio-store')
    }
    
    await supabase.auth.signOut()
    router.push('/login')
  } catch (e) {
    console.error('Failed to sign out', e)
  }
}

const openPortal = async () => {
  const customerId = userinfo.value?.customerId
  if (!customerId) {
    goPricing()
    return
  }
  try {
    const returnUrl = `${window.location.origin}/profile?from=portal`
    const resp = await subscriptionClient.post(`/customers/${customerId}/portal`, {
      returnUrl,
    })
    const url = resp.data?.portalUrl
    if (url) {
      window.location.href = url
    } else {
      goPricing()
    }
  } catch (e) {
    console.error('Failed to open portal', e)
    goPricing()
  }
}

const upgradeSubscription = async (target: 'member') => {
  const subscriptionId = userinfo.value?.subscriptionId
  if (!subscriptionId) {
    error.value = 'No active subscription found'
    return
  }
  
  try {
    isLoading.value = true
    error.value = null
    const plan = plansData.value.find((p: any) => p.slug === target)
    if (!plan || !(plan as any).productId) {
      throw new Error('Plan not found. Please refresh the page.')
    }
    
    const updateBehavior = 'proration-none'
    await subscriptionClient.post(`/subscriptions/${subscriptionId}/upgrade`, {
      productId: (plan as any).productId,
      updateBehavior,
    })
    await loadUserInfo()
    alert(t('profile.subscriptionUpdated'))
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
  const subscriptionId = userinfo.value?.subscriptionId
  try {
    isLoading.value = true
    await subscriptionClient.post(`/subscriptions/${subscriptionId}/cancel`)
    await loadUserInfo()
  } catch (e) {
    console.error('Failed to cancel subscription', e)
  } finally {
    isLoading.value = false
  }
}

const loadPlans = async () => {
  try {
    const response = await subscriptionClient.get('/plans')
    plansData.value = response.data.plans || []
  } catch (e: any) {
    console.error('Failed to load plans:', e)
  }
}

const initializeData = async () => {
  await Promise.all([
    loadPlans(),
    loadCredits(),
    loadUserInfo()
  ])
}

const getPlanAction = (targetSlug: string): () => void => {
  const currentSlug = planSlug.value
  const currentStatus = status.value
  const isCurrentPlanActive = currentSlug !== 'free' && (currentStatus === 'Active' || currentStatus === 'Trialing')
  const isCanceledOrExpired = currentStatus === 'Canceled' || currentStatus === 'Expired'
  
  if (targetSlug === currentSlug && isCurrentPlanActive) {
    return () => cancelSubscription()
  } else if (isCanceledOrExpired || currentSlug === 'free') {
    return () => startCheckout(targetSlug as 'member')
  } else {
    return () => upgradeSubscription(targetSlug as 'member')
  }
}

const plans = computed(() => {
  if (plansData.value.length === 0) {
    return []
  }
  return plansData.value.map((plan) => ({
    ...plan,
    action: getPlanAction(plan.slug),
  }))
})

const actionLabel = (slug: string) => {
  if (slug === planSlug.value) {
    if (planSlug.value !== 'free' && (status.value === 'Active' || status.value === 'Trialing')) {
      return t('profile.cancelSubscription')
    }
    return t('profile.current') + ' ' + t('profile.plan')
  }
  if (status.value === 'Canceled' || status.value === 'Expired') {
    return t('profile.subscribe')
  }
  const currentRank = planRank[planSlug.value] ?? 0
  const targetRank = planRank[slug] ?? 0
  return targetRank > currentRank ? t('profile.upgrade') : t('profile.downgrade')
}

const isActionDisabled = (slug: string) => {
  if (slug === planSlug.value) {
    if (planSlug.value !== 'free' && (status.value === 'Active' || status.value === 'Trialing')) {
      return isLoading.value
    }
    return true
  }
  return isLoading.value
}

// SEO functions
const connectSearchConsole = async () => {
  try {
    const response = await apiClient.get('/seo/search-console/connect')
    if (response.data.authUrl) {
      window.location.href = response.data.authUrl
    }
  } catch (error: any) {
    console.error('Failed to connect:', error)
    alert(error?.response?.data?.error || 'Failed to connect to Google Search Console')
  }
}

const disconnectSearchConsole = async () => {
  try {
    await apiClient.post('/seo/search-console/disconnect')
    isConnected.value = false
    alert('Disconnected from Google Search Console')
  } catch (error: any) {
    console.error('Failed to disconnect:', error)
    alert(error?.response?.data?.error || 'Failed to disconnect')
  }
}

const verifySite = async () => {
  isVerifying.value = true
  verificationStatus.value = null
  try {
    const response = await apiClient.post('/seo/verify-site', { siteUrl: siteUrl.value })
    verificationStatus.value = {
      success: response.data.verified,
      message: response.data.message || (response.data.verified ? 'Site verified successfully' : 'Site verification failed'),
    }
  } catch (error: any) {
    verificationStatus.value = {
      success: false,
      message: error?.response?.data?.error || 'Verification failed',
    }
  } finally {
    isVerifying.value = false
  }
}

const submitSitemap = async () => {
  isSubmittingSitemap.value = true
  sitemapStatus.value = null
  try {
    const response = await apiClient.post('/seo/submit-sitemap', { sitemapUrl: sitemapUrl.value })
    sitemapStatus.value = {
      success: response.data.success,
      message: response.data.message || (response.data.success ? 'Sitemap submitted successfully' : 'Sitemap submission failed'),
    }
  } catch (error: any) {
    sitemapStatus.value = {
      success: false,
      message: error?.response?.data?.error || 'Sitemap submission failed',
    }
  } finally {
    isSubmittingSitemap.value = false
  }
}

const inspectUrl = async () => {
  isInspecting.value = true
  inspectionResult.value = null
  try {
    const response = await apiClient.post('/seo/inspect-url', { url: inspectionUrl.value })
    inspectionResult.value = response.data
  } catch (error: any) {
    inspectionResult.value = {
      indexingStatus: 'ERROR',
      errors: [error?.response?.data?.error || 'Inspection failed'],
    }
  } finally {
    isInspecting.value = false
  }
}

const loadAnalytics = async () => {
  isLoadingAnalytics.value = true
  analyticsData.value = null
  try {
    const response = await apiClient.get('/seo/analytics', {
      params: {
        startDate: dateRange.value.start,
        endDate: dateRange.value.end,
      },
    })
    analyticsData.value = response.data
  } catch (error: any) {
    console.error('Failed to load analytics:', error)
    alert(error?.response?.data?.error || 'Failed to load analytics data')
  } finally {
    isLoadingAnalytics.value = false
  }
}

const checkConnectionStatus = async () => {
  try {
    const response = await apiClient.get('/seo/search-console/status')
    isConnected.value = response.data.connected || false
  } catch (error) {
    console.error('Failed to check connection status:', error)
    isConnected.value = false
  }
}

onMounted(async () => {
  userEmail.value = '—'
  userinfo.value = null
  error.value = null
  
  await initializeData()
  await checkConnectionStatus()
  
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('from') === 'portal') {
    console.log('🔄 Detected return from portal via URL parameter')
    window.history.replaceState({}, '', '/profile')
  }
  
  // Check if navigating to SEO tab
  if (urlParams.get('tab') === 'seo') {
    activeTab.value = 'seo'
  }
})
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-y-auto">
    <!-- Account Content -->
    <div v-if="activeTab === 'account'" class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 -m-4 p-4">
      <div class="max-w-4xl mx-auto space-y-8 py-8">
        <div>
          <h2 class="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-2">
            {{ $t('profile.title') }}
          </h2>
          <p class="text-xl text-gray-600 mt-2">{{ $t('profile.subtitle') }}</p>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="bg-white rounded-2xl border border-pink-100 shadow-lg p-6 hover:shadow-xl transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ $t('profile.subscription') }}</h3>
              <span class="text-sm text-pink-600 font-medium">{{ isLoading ? $t('profile.loading') : $t('profile.updated') }}</span>
            </div>
            <div class="space-y-3">
              <div class="flex justify-between text-sm text-gray-700">
                <span>{{ $t('profile.currentPlan') }}</span>
                <span class="font-semibold text-gray-900">{{ planDisplay }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-700">
                <span>{{ $t('profile.status') }}</span>
                <span class="font-semibold text-gray-900">{{ status }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-700">
                <span>{{ $t('profile.remainingFreeCredits') }}</span>
                <span class="font-semibold text-gray-900">
                  {{ freeRemainingTries }}/3 ({{ $t('profile.dailyLimit') }})
                </span>
              </div>
              <div class="flex justify-between text-sm text-gray-700">
                <span>{{ $t('profile.remainingCredits') }}</span>
                <span class="font-semibold text-gray-900">{{ remainingCredits }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-700" v-if="nextResetDate">
                <span>{{ $t('profile.nextReset') }}</span>
                <span class="font-semibold text-gray-900">{{ nextResetDate }}</span>
              </div>
            </div>
            <div v-if="planSlug !== 'free' && (status === 'Active' || status === 'Trialing')" class="mt-4 pt-4 border-t border-pink-200">
              <Button 
                variant="outline" 
                class="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                :disabled="isLoading"
                @click="cancelSubscription"
              >
                {{ $t('profile.cancelSubscription') }}
              </Button>
            </div>
            <p v-if="error" class="mt-3 text-sm text-red-600 font-medium">{{ error }}</p>
          </div>

          <div class="bg-white rounded-2xl border border-pink-100 shadow-lg p-6 hover:shadow-xl transition-all">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ $t('profile.account') }}</h3>
            </div>
            <div class="space-y-3 text-sm text-gray-700">
              <p>{{ $t('profile.signInEmail') }}: <span class="font-semibold">{{ userEmail }}</span></p>
              <p v-if="userinfo?.subscriptionId">{{ $t('profile.billingPeriod') }}: <span class="font-semibold">{{ $t('profile.monthly') }}</span></p>
              <p v-if="userinfo?.period">{{ $t('profile.creditsResetPeriod') }}: <span class="font-semibold">{{ userinfo.period }}</span></p>
            </div>
            <div class="mt-6 space-y-3">
              <Button variant="outline" class="w-full" @click="openPortal">{{ $t('profile.customerPortal') }}</Button>
              <Button variant="secondary" class="w-full" @click="signOut">{{ $t('profile.signOut') }}</Button>
            </div>
          </div>
        </div>

        <!-- Subscription Plans -->
        <div class="bg-white rounded-2xl border border-pink-100 shadow-lg p-6 space-y-4 hover:shadow-xl transition-all">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ $t('profile.subscriptionPlans') }}</h3>
            <span class="text-sm text-pink-600 font-medium">{{ $t('profile.monthlyRecurring') }}</span>
          </div>
          <div class="grid gap-4 md:grid-cols-1">
            <div
              v-for="plan in plans"
              :key="plan.slug"
              class="border-2 rounded-xl p-4 space-y-3 transition-all"
              :class="plan.slug === planSlug ? 'border-pink-500 bg-gradient-to-br from-pink-50 to-purple-50 shadow-lg' : 'border-pink-200 hover:border-pink-300 hover:shadow-md'"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold text-gray-900">{{ plan.name }}</p>
                  <p class="text-sm bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent font-medium">{{ plan.price }}</p>
                </div>
                <span
                  v-if="plan.slug === planSlug"
                  class="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold shadow-md"
                >{{ $t('profile.current') }}</span>
              </div>
              <p class="text-sm text-gray-600">{{ plan.desc }}</p>
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

        <!-- Credits -->
        <div class="bg-white rounded-2xl border border-pink-100 shadow-lg p-6 space-y-4 hover:shadow-xl transition-all">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ $t('profile.credits') }}</h3>
            <span class="text-sm text-pink-600 font-medium">{{ $t('profile.oneTimePurchase') }}</span>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="credit in creditsData"
              :key="credit.id"
              class="border-2 rounded-xl p-4 space-y-3 border-pink-200 hover:border-pink-400 hover:shadow-lg transition-all transform hover:-translate-y-1"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <p class="font-semibold text-gray-900">{{ credit.name }}</p>
                  <div v-if="getCreditDiscountInfo(credit)" class="flex items-center gap-2 mt-1">
                    <span class="text-xs line-through text-gray-400">${{ getCreditDiscountInfo(credit)!.originalPrice.toFixed(2) }}</span>
                    <span class="text-sm font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">${{ credit.price.toFixed(2) }}</span>
                    <span class="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded">-{{ ((1 - getCreditDiscountInfo(credit)!.discount) * 100).toFixed(0) }}%</span>
                  </div>
                  <p v-else class="text-sm bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent font-medium">${{ credit.price.toFixed(2) }}</p>
                </div>
              </div>
              <p class="text-sm text-gray-700 font-medium">{{ credit.credits }} credits</p>
              <p class="text-sm text-gray-600">{{ $t('profile.creditsNeverExpire') }}</p>
              <Button
                class="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl rounded-full"
                :disabled="isLoading"
                @click="purchaseCredits(credit.id)"
              >
                {{ isLoading ? $t('profile.processing') : $t('profile.purchase') }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SEO Content -->
    <div v-if="activeTab === 'seo'" class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="mb-8">
        <h2 class="text-4xl font-bold text-gray-900 mb-2">{{ $t('seo.title') }}</h2>
        <p class="text-gray-600">{{ $t('seo.subtitle') }}</p>
      </div>

      <!-- Connection Status -->
      <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ $t('seo.connectionStatus') }}</h3>
            <p class="text-gray-600 text-sm">
              <span v-if="isConnected" class="text-green-600 font-medium">{{ $t('seo.connected') }}</span>
              <span v-else class="text-gray-500">{{ $t('seo.notConnected') }}</span>
            </p>
          </div>
          <Button
            v-if="!isConnected"
            @click="connectSearchConsole"
            class="bg-pink-600 hover:bg-pink-700"
          >
            {{ $t('seo.connect') }}
          </Button>
          <Button
            v-else
            variant="outline"
            @click="disconnectSearchConsole"
          >
            {{ $t('seo.disconnect') }}
          </Button>
        </div>
      </div>

      <!-- Site Verification -->
      <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
        <h3 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('seo.siteVerification') }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('seo.verifyWebsite') }}</label>
            <div class="flex gap-4">
              <input
                v-model="siteUrl"
                type="text"
                placeholder="https://fashion-rec.com"
                class="flex-1 px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <Button
                @click="verifySite"
                :disabled="isVerifying"
                class="bg-pink-600 hover:bg-pink-700"
              >
                {{ isVerifying ? $t('seo.verifying') : $t('seo.verify') }}
              </Button>
            </div>
          </div>
          <div v-if="verificationStatus" class="p-4 rounded-lg" :class="verificationStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
            {{ verificationStatus.message }}
          </div>
        </div>
      </div>

      <!-- Sitemap Submission -->
      <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
        <h3 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('seo.sitemapSubmission') }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('seo.submitSitemap') }}</label>
            <div class="flex gap-4">
              <input
                v-model="sitemapUrl"
                type="text"
                placeholder="https://fashion-rec.com/sitemap.xml"
                class="flex-1 px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <Button
                @click="submitSitemap"
                :disabled="isSubmittingSitemap"
                class="bg-pink-600 hover:bg-pink-700"
              >
                {{ isSubmittingSitemap ? $t('seo.submitting') : $t('seo.submit') }}
              </Button>
            </div>
          </div>
          <div v-if="sitemapStatus" class="p-4 rounded-lg" :class="sitemapStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
            {{ sitemapStatus.message }}
          </div>
        </div>
      </div>

      <!-- URL Inspection Tool -->
      <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
        <h3 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('seo.urlInspection') }}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('seo.checkUrlIndexing') }}</label>
            <div class="flex gap-4">
              <input
                v-model="inspectionUrl"
                type="text"
                placeholder="https://fashion-rec.com/blog/example"
                class="flex-1 px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <Button
                @click="inspectUrl"
                :disabled="isInspecting"
                class="bg-pink-600 hover:bg-pink-700"
              >
                {{ isInspecting ? $t('seo.checking') : $t('seo.inspect') }}
              </Button>
            </div>
          </div>
          <div v-if="inspectionResult" class="p-4 bg-gray-50 rounded-lg">
            <h4 class="font-semibold text-gray-900 mb-2">{{ $t('seo.inspectionResult') }}</h4>
            <div class="space-y-2 text-sm">
              <div>
                <span class="font-medium">{{ $t('seo.indexingStatus') }}:</span>
                <span :class="inspectionResult.indexingStatus === 'INDEXED' ? 'text-green-600' : 'text-yellow-600'">
                  {{ inspectionResult.indexingStatus || 'Unknown' }}
                </span>
              </div>
              <div v-if="inspectionResult.lastCrawlTime">
                <span class="font-medium">{{ $t('seo.lastCrawl') }}:</span>
                <span class="text-gray-600">{{ new Date(inspectionResult.lastCrawlTime).toLocaleString() }}</span>
              </div>
              <div v-if="inspectionResult.errors && inspectionResult.errors.length > 0">
                <span class="font-medium text-red-600">{{ $t('seo.errors') }}:</span>
                <ul class="list-disc list-inside text-red-600">
                  <li v-for="error in inspectionResult.errors" :key="error">{{ error }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analytics Reports -->
      <div class="bg-white rounded-lg shadow-sm border border-pink-200 p-6 mb-6">
        <h3 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('seo.searchPerformance') }}</h3>
        <div class="space-y-4">
          <div class="flex gap-4 items-end">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('seo.dateRange') }}</label>
              <div class="flex gap-2">
                <input
                  v-model="dateRange.start"
                  type="date"
                  class="px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <span class="self-center text-gray-500">to</span>
                <input
                  v-model="dateRange.end"
                  type="date"
                  class="px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            </div>
            <Button
              @click="loadAnalytics"
              :disabled="isLoadingAnalytics"
              class="bg-pink-600 hover:bg-pink-700"
            >
              {{ isLoadingAnalytics ? $t('seo.loading') : $t('seo.loadReport') }}
            </Button>
          </div>

          <div v-if="analyticsData" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div class="p-4 bg-pink-50 rounded-lg">
              <div class="text-sm text-gray-600 mb-1">{{ $t('seo.totalClicks') }}</div>
              <div class="text-2xl font-bold text-pink-600">{{ analyticsData.clicks || 0 }}</div>
            </div>
            <div class="p-4 bg-purple-50 rounded-lg">
              <div class="text-sm text-gray-600 mb-1">{{ $t('seo.totalImpressions') }}</div>
              <div class="text-2xl font-bold text-purple-600">{{ analyticsData.impressions || 0 }}</div>
            </div>
            <div class="p-4 bg-blue-50 rounded-lg">
              <div class="text-sm text-gray-600 mb-1">{{ $t('seo.averageCTR') }}</div>
              <div class="text-2xl font-bold text-blue-600">{{ analyticsData.ctr ? (analyticsData.ctr * 100).toFixed(2) + '%' : '0%' }}</div>
            </div>
          </div>

          <div v-if="analyticsData && analyticsData.topQueries && analyticsData.topQueries.length > 0" class="mt-6">
            <h4 class="font-semibold text-gray-900 mb-3">{{ $t('seo.topQueries') }}</h4>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{{ $t('seo.query') }}</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{{ $t('seo.clicks') }}</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{{ $t('seo.impressions') }}</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{{ $t('seo.ctr') }}</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="query in analyticsData.topQueries" :key="query.query">
                    <td class="px-4 py-3 text-sm text-gray-900">{{ query.query }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ query.clicks }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ query.impressions }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ (query.ctr * 100).toFixed(2) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
