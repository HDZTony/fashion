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

const subscriptionClient = axios.create({
  baseURL: SUBSCRIPTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const planName = computed(() => subscriptionInfo.value?.planName || 'Free')
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
                <span class="font-semibold text-gray-900">{{ planName }}</span>
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
              <p>Sign-in email: <span class="font-semibold">{{ subscriptionInfo?.email || '—' }}</span></p>
              <p>Billing period: <span class="font-semibold">{{ subscriptionInfo?.period || 'daily' }}</span></p>
              <p>Tip: upgrade to get more try-ons and priority processing.</p>
            </div>
            <div class="mt-6">
              <Button variant="outline" class="w-full" @click="goPricing">Upgrade or manage subscription</Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

