<template>
  <view class="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-purple-50 p-4 relative overflow-hidden">
    <view class="absolute inset-0 -z-10">
      <view class="absolute top-0 left-1/4 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl" />
      <view class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
    </view>

    <view class="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center border border-pink-100">
      <view v-if="!error" class="flex flex-col items-center gap-4">
        <view class="w-16 h-16 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <text class="text-pink-600 font-medium text-lg">{{ t('login.completingSignIn') }}</text>
      </view>
      <view v-else class="flex flex-col gap-4 text-red-600">
        <text class="font-medium mb-2 text-lg block">{{ error }}</text>
        <text class="text-sm text-pink-600 mt-2 block">{{ t('login.redirectingToLogin') }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const error = ref('')

onMounted(async () => {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) throw sessionError

    if (data.session) {
      uni.setStorageSync('auth_token', data.session.access_token)
      uni.reLaunch({ url: '/pages/index/index' })
    } else {
      error.value = t('login.noSessionFound')
      setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 3000)
    }
  } catch (err: unknown) {
    console.error('Callback error:', err)
    error.value = (err as { message?: string })?.message || t('errors.authFailed')
    setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 2000)
  }
})
</script>
