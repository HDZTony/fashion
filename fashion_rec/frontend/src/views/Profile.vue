<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'

defineOptions({ name: 'Profile' })

const router = useRouter()

const SUBSCRIPTION_API_URL = import.meta.env.VITE_SUBSCRIPTION_API_URL || 'http://localhost:3001'

const isLoading = ref(false)
const error = ref<string | null>(null)
const subscriptionInfo = ref<any>(null)
const userEmail = ref<string>('—')
const isTestMode = import.meta.env.VITE_CREEM_TEST_MODE === 'true'

const subscriptionClient = axios.create({
  baseURL: SUBSCRIPTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const planNameRaw = computed(() => subscriptionInfo.value?.planName || 'Free')
const planDisplay = computed(() => {
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'premium_plus' || name === 'premium plus') return 'Premium Plus ($15)'
  if (name === 'premium' || name === '高级版') return 'Premium ($5)'
  if (name === '免费版') return 'Free'
  return subscriptionInfo.value?.planName || 'Free'
})
const planSlug = computed(() => {
  const name = (planNameRaw.value || '').toString().toLowerCase()
  if (name === 'premium_plus' || name === 'premium plus') return 'premium_plus'
  if (name === 'premium' || name === '高级版') return 'premium'
  return 'free'
})
const planRank: Record<string, number> = { free: 0, premium: 1, premium_plus: 2 }
const remainingTries = computed(() => subscriptionInfo.value?.remainingTries ?? 0)
const totalTries = computed(() => subscriptionInfo.value?.totalTries ?? 0)
const nextResetDate = computed(() => subscriptionInfo.value?.nextResetDate || '')
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

const loadSubscriptionInfo = async () => {
  isLoading.value = true
  error.value = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Please sign in first')
    userEmail.value = user.email || '—'

    const session = await supabase.auth.getSession()
    const response = await subscriptionClient.get('/subscription/status', {
      params: { user_id: user.id },
      headers: {
        Authorization: `Bearer ${session.data.session?.access_token || user.id}`,
      },
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

// Manage subscription portal
const openPortal = async () => {
  const customerId = subscriptionInfo.value?.customerId || subscriptionInfo.value?.customer_id
  if (!customerId) {
    goPricing()
    return
  }
  try {
    const resp = await subscriptionClient.post(`/customers/${customerId}/portal`)
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

const getProductIdForPlan = (target: 'premium' | 'premium_plus') => {
  if (target === 'premium_plus') {
    return isTestMode
      ? (import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS_TEST || import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS || 'prod_6YsIDqxb9lnMmVarSuUfBc')
      : (import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS_PROD || import.meta.env.VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS || 'prod_6YsIDqxb9lnMmVarSuUfBc')
  }
  return isTestMode
    ? (import.meta.env.VITE_CREEM_PRODUCT_ID_TEST || import.meta.env.VITE_CREEM_PRODUCT_ID)
    : (import.meta.env.VITE_CREEM_PRODUCT_ID_PROD || import.meta.env.VITE_CREEM_PRODUCT_ID)
}

// Upgrade/downgrade existing subscription
const upgradeSubscription = async (target: 'premium' | 'premium_plus') => {
  const subscriptionId = subscriptionInfo.value?.subscriptionId || subscriptionInfo.value?.subscription_id
  if (!subscriptionId) {
    // No existing subscription, use checkout instead
    return startCheckout(target)
  }
  try {
    isLoading.value = true
    error.value = null
    
    // Determine if this is an upgrade or downgrade
    const currentRank = planRank[planSlug.value] ?? 0
    const targetRank = planRank[target] ?? 0
    const isUpgrade = targetRank > currentRank
    
    // Use different updateBehavior based on upgrade/downgrade
    // For downgrades, use proration-charge (credit to next invoice) instead of immediate charge
    // For upgrades, use proration-charge-immediately (charge immediately)
    const updateBehavior = isUpgrade 
      ? 'proration-charge-immediately' 
      : 'proration-charge'
    
    const productId = getProductIdForPlan(target)
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
    error.value = errorMsg
    
    // If Forbidden error, suggest using customer portal
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

// Start new checkout (for users without subscription)
const startCheckout = async (target: 'premium' | 'premium_plus') => {
  try {
    isLoading.value = true
    error.value = null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Please sign in first')

    const productId = getProductIdForPlan(target)
    const response = await subscriptionClient.post('/checkouts', {
      productId,
      successUrl: `${window.location.origin}/pricing?success=true`,
      cancelUrl: `${window.location.origin}/pricing?canceled=true`,
      metadata: { userId: user.id },
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
  if (!subscriptionId) {
    goPricing()
    return
  }
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

const plans = computed(() => ([
  {
    slug: 'free',
    name: 'Free',
    price: '$0',
    tries: '1/day',
    desc: 'Core features and saved history',
    action: () => cancelSubscription(), // downgrade to free via cancel
  },
  {
    slug: 'premium',
    name: 'Premium',
    price: '$5 / mo',
    tries: '50 / month',
    desc: 'More try-ons and priority',
    action: () => upgradeSubscription('premium'),
  },
  {
    slug: 'premium_plus',
    name: 'Premium Plus',
    price: '$15 / mo',
    tries: '200 / month',
    desc: 'Highest limits and priority',
    action: () => upgradeSubscription('premium_plus'),
  },
]))

const actionLabel = (slug: string) => {
  if (slug === planSlug.value) return 'Current plan'
  const currentRank = planRank[planSlug.value] ?? 0
  const targetRank = planRank[slug] ?? 0
  return targetRank > currentRank ? 'Upgrade' : 'Downgrade'
}

const isActionDisabled = (slug: string) => slug === planSlug.value || isLoading.value

onMounted(() => {
  loadSubscriptionInfo()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <main class="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Profile</h1>
          <p class="text-gray-600 mt-2">View your subscription status and remaining tries</p>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900">Subscription</h2>
              <span class="text-sm text-gray-500">{{ isLoading ? 'Loading...' : 'Updated' }}</span>
            </div>
            <div class="space-y-3">
              <div class="flex justify-between text-sm text-gray-600">
                <span>Current plan</span>
                <span class="font-semibold text-gray-900">{{ planDisplay }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-600">
                <span>Status</span>
                <span class="font-semibold text-gray-900">{{ status }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-600">
                <span>Remaining tries</span>
                <span class="font-semibold text-gray-900">{{ remainingTries }} / {{ totalTries }}</span>
              </div>
              <div class="flex justify-between text-sm text-gray-600" v-if="nextResetDate">
                <span>Next reset</span>
                <span class="font-semibold text-gray-900">{{ nextResetDate }}</span>
              </div>
            </div>
            <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
          </div>

          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900">Account</h2>
            </div>
            <div class="space-y-3 text-sm text-gray-700">
              <p>Sign-in email: <span class="font-semibold">{{ userEmail }}</span></p>
              <p>Billing period: <span class="font-semibold">{{ subscriptionInfo?.period || 'daily' }}</span></p>
              <p>Tip: upgrade to get more try-ons and priority processing.</p>
            </div>
            <div class="mt-6 space-y-3">
              <Button variant="outline" class="w-full" @click="openPortal">Manage subscription</Button>
              <Button variant="secondary" class="w-full" @click="signOut">Sign out</Button>
            </div>
          </div>
        </div>

        <!-- Plans -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">Plans</h2>
            <span class="text-sm text-gray-500">Upgrade or downgrade</span>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            <div
              v-for="plan in plans"
              :key="plan.slug"
              class="border rounded-xl p-4 space-y-3"
              :class="plan.slug === planSlug ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold text-gray-900">{{ plan.name }}</p>
                  <p class="text-sm text-gray-500">{{ plan.price }}</p>
                </div>
                <span
                  v-if="plan.slug === planSlug"
                  class="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700"
                >Current</span>
              </div>
              <p class="text-sm text-gray-600">Includes: {{ plan.tries }}</p>
              <p class="text-sm text-gray-500">{{ plan.desc }}</p>
              <Button
                class="w-full"
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

