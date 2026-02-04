<template>
  <view class="p-6 min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
    <text class="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-2">{{ t('profile.title') }}</text>
    <text class="text-sm text-gray-500 block mb-6">{{ t('profile.subtitle') }}</text>

    <view v-if="loading" class="block my-10 text-center text-gray-500">{{ t('common.loading') }}</view>
    <view v-else-if="userinfo" class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
      <view class="flex justify-between items-center py-4 border-b border-gray-100">
        <text class="text-sm text-gray-500">{{ t('profile.signInEmail') }}</text>
        <text class="text-sm font-medium">{{ userEmail }}</text>
      </view>
      <view class="flex justify-between items-center py-4 border-b border-gray-100">
        <text class="text-sm text-gray-500">{{ t('profile.currentPlan') }}</text>
        <text class="text-sm font-medium">{{ userinfo.planName || t('profile.free') }}</text>
      </view>
      <view class="flex justify-between items-center py-4 border-b border-gray-100">
        <text class="text-sm text-gray-500">{{ t('profile.remainingCredits') }}</text>
        <text class="text-sm font-medium">{{ userinfo.credits ?? 0 }}</text>
      </view>
      <view v-if="userinfo.dailyFreeTriesRemaining != null" class="flex justify-between items-center py-4 border-b border-gray-100">
        <text class="text-sm text-gray-500">{{ t('profile.remainingFreeCredits') }}</text>
        <text class="text-sm font-medium">{{ userinfo.dailyFreeTriesRemaining }}</text>
      </view>
      <view v-if="userinfo.nextResetDate" class="flex justify-between items-center py-4 border-b border-gray-100">
        <text class="text-sm text-gray-500">{{ t('profile.nextReset') }}</text>
        <text class="text-sm font-medium">{{ formatDate(userinfo.nextResetDate) }}</text>
      </view>
    </view>

    <button class="w-full py-4 px-6 mt-6 border-2 border-pink-200 text-pink-600 rounded-2xl text-sm font-medium" @click="logout">{{ t('profile.signOut') }}</button>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { subscriptionClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import { useStudioStore } from '@/store/studio'
import type { UserInfo } from '@fashion-rec/shared'

const props = defineProps<{ embedded?: boolean }>()
const { t } = useI18n()
const userinfo = ref<UserInfo | null>(null)
const userEmail = ref('')
const loading = ref(false)

onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/profile/profile') })
    return
  }
  loadUserInfo()
})
onMounted(() => {
  if (props.embedded) loadUserInfo()
})

async function loadUserInfo() {
  loading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userEmail.value = user.email || ''
    const res = await subscriptionClient.get('/userinfo', {
      params: { user_id: user?.id },
    })
    userinfo.value = res.data
  } catch (_) {
    userinfo.value = { planName: 'Free', credits: 0, period: 'daily', nextResetDate: null, subscriptionId: null, customerId: null, status: null }
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

function logout() {
  useStudioStore().clearState()
  uni.removeStorageSync('auth_token')
  uni.removeStorageSync('studio-store')
  uni.reLaunch({ url: '/pages/login/login' })
}
</script>

