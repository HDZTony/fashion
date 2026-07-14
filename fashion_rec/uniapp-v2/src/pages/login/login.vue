<template>
  <view class="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-purple-50 p-4 relative overflow-hidden">
    <view class="absolute inset-0 -z-10">
      <view class="absolute top-0 left-1/4 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl" />
      <view class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl" />
    </view>

    <view class="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-pink-100">
      <text class="text-4xl font-bold mb-2 text-center bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block">{{ t('login.title') }}</text>
      <text class="text-gray-600 mb-8 text-center text-lg block">{{ isForgotPassword ? t('login.subtitle.forgotPassword') : (isSignUp ? t('login.subtitle.signUp') : t('login.subtitle.signIn')) }}</text>

      <!-- 密码找回 -->
      <view v-if="isForgotPassword" class="space-y-4">
        <input v-model="resetEmail" type="text" :placeholder="t('login.enterEmailAddress')" class="w-full px-4 py-3 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 transition-all" />
        <button :loading="loading" :disabled="loading" @click="sendReset" class="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {{ t('login.sendResetLink') }}
        </button>
        <view class="pt-4 border-t border-gray-200">
          <button @click="isForgotPassword = false" class="w-full text-sm text-pink-600 hover:text-pink-700 font-medium transition-colors bg-transparent border-none">
            {{ t('login.backToLogin') }}
          </button>
        </view>
      </view>

      <!-- 登录/注册 -->
      <view v-else class="space-y-4">
        <input v-model="email" type="text" :placeholder="t('login.enterEmail')" class="w-full px-4 py-3 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 transition-all" />
        <input v-model="password" type="password" :placeholder="t('login.enterPassword')" class="w-full px-4 py-3 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 transition-all" />
        <view v-if="!isSignUp" class="flex justify-end mt-2">
          <button @click="isForgotPassword = true" class="text-sm text-pink-600 hover:text-pink-700 font-medium transition-colors bg-transparent border-none">
            {{ t('login.forgotPassword') }}
          </button>
        </view>
        <button :loading="loading" :disabled="loading" @click="signIn" class="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {{ loading ? (isSignUp ? t('login.signingUp') : t('login.signingIn')) : (isSignUp ? t('login.signUp') : t('login.signIn')) }}
        </button>

        <!-- Divider -->
        <view class="relative my-6">
          <view class="absolute inset-0 flex items-center">
            <view class="w-full border-t border-gray-200" />
          </view>
          <view class="relative flex justify-center text-sm">
            <text class="px-2 bg-white text-gray-500">{{ t('login.continueWith') }}</text>
          </view>
        </view>

        <!-- Google Login -->
        <button :disabled="loading" @click="handleGoogleLogin" class="w-full flex items-center justify-center gap-3 bg-white border-2 border-pink-200 text-gray-700 py-3 rounded-full font-medium hover:bg-pink-50 hover:border-pink-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <image class="w-5 h-5" src="/static/google-g.svg" mode="aspectFit" />
          <text>{{ t('login.continueWithGoogle') }}</text>
        </button>

        <text v-if="error" class="text-sm text-center font-medium block" :class="isSuccess ? 'text-pink-600' : 'text-red-600'">{{ error }}</text>

        <view v-if="showResendConfirmation" class="pt-2">
          <button :disabled="loading || resendCooldown > 0" @click="handleResendConfirmation" class="w-full text-sm text-pink-600 hover:text-pink-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed underline bg-transparent border-none">
            {{ resendCooldown > 0 ? t('login.resendWait', { seconds: resendCooldown }) : t('login.resendConfirmation') }}
          </button>
        </view>

        <view class="pt-4 border-t border-gray-200">
          <button @click="toggleMode" class="w-full text-sm text-pink-600 hover:text-pink-700 font-medium transition-colors bg-transparent border-none">
            {{ isSignUp ? t('login.hasAccount') + '? ' + t('login.signIn') : t('login.needAccount') }}
          </button>
        </view>
      </view>

      <!-- Footer -->
      <view class="mt-6 pt-4 border-t border-pink-200 flex justify-center gap-4 text-xs text-gray-600">
        <text class="font-medium">Privacy Policy</text>
        <text class="text-pink-300">|</text>
        <text class="font-medium">Terms of Service</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { signInWithGoogleWeb } from '@fashion-rec/shared'
import { supabase } from '@/lib/supabase'

const { t } = useI18n()
const email = ref('')
const password = ref('')
const resetEmail = ref('')
const loading = ref(false)
const error = ref('')
const isSignUp = ref(false)
const isForgotPassword = ref(false)
const showResendConfirmation = ref(false)
const resendCooldown = ref(0)
let redirectUrl = ''
let resendTimer: ReturnType<typeof setInterval> | null = null

const isSuccess = computed(() => {
  const s = error.value.toLowerCase()
  return s.includes('success') || s.includes('sent')
})

onLoad((options) => {
  redirectUrl = (options?.redirect as string) || ''
})

function toggleMode() {
  isSignUp.value = !isSignUp.value
  isForgotPassword.value = false
  showResendConfirmation.value = false
  error.value = ''
  password.value = ''
  if (resendTimer) {
    clearInterval(resendTimer)
    resendTimer = null
  }
  resendCooldown.value = 0
}

function afterLogin() {
  const target = redirectUrl ? decodeURIComponent(redirectUrl) : '/pages/index/index'
  uni.reLaunch({ url: target })
}

function getCallbackUrl(): string {
  if (typeof window === 'undefined') return ''
  const origin = window.location.origin
  const path = window.location.pathname || '/'
  return `${origin}${path}#/pages/callback/callback`
}

async function signIn() {
  console.log('[Login] signIn clicked', { email: email.value, isSignUp: isSignUp.value, redirectUrl })
  if (!email.value) {
    error.value = t('login.pleaseEnterEmail')
    return
  }
  if (!password.value) {
    error.value = t('login.pleaseEnterPassword')
    return
  }
  loading.value = true
  error.value = ''
  try {
    console.log('[Login] calling auth...')

    if (isSignUp.value) {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: { emailRedirectTo: getCallbackUrl() },
      })
      if (err) {
        if (err?.message?.includes('already registered')) {
          error.value = t('login.emailAlreadyRegistered')
          isSignUp.value = false
        } else throw err
        return
      }
      if (data.session) {
        uni.setStorageSync('auth_token', data.session.access_token)
        afterLogin()
      } else {
        error.value = t('login.signUpCheckEmail')
        showResendConfirmation.value = true
        resendCooldown.value = 60
        if (resendTimer) clearInterval(resendTimer)
        resendTimer = setInterval(() => {
          resendCooldown.value--
          if (resendCooldown.value <= 0 && resendTimer) {
            clearInterval(resendTimer)
            resendTimer = null
          }
        }, 1000)
      }
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      console.log('[Login] signInWithPassword result', { hasData: !!data, hasSession: !!data?.session, err: err?.message })
      if (err) {
        if (err?.message?.includes('Invalid login credentials')) error.value = t('login.incorrectCredentials')
        else if (err?.message?.includes('Email not confirmed')) {
          error.value = t('login.emailNotConfirmed')
          showResendConfirmation.value = true
          resendCooldown.value = 60
          if (resendTimer) clearInterval(resendTimer)
          resendTimer = setInterval(() => {
            resendCooldown.value--
            if (resendCooldown.value <= 0 && resendTimer) {
              clearInterval(resendTimer)
              resendTimer = null
            }
          }, 1000)
        } else throw err
        return
      }
      if (data.session?.access_token) {
        uni.setStorageSync('auth_token', data.session.access_token)
        afterLogin()
      }
    }
  } catch (e: unknown) {
    console.error('[Login] signIn error', e)
    error.value = (e as { message?: string })?.message || (isSignUp.value ? t('login.signUpFailed') : t('login.signInFailed'))
  } finally {
    loading.value = false
  }
}

async function sendReset() {
  if (!resetEmail.value) {
    error.value = t('login.pleaseEnterEmailAddress')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.value, {
      redirectTo: `${getCallbackUrl()}?type=recovery`,
    })
    if (err) throw err
    error.value = t('login.passwordResetSent')
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message || t('login.resetFailed')
  } finally {
    loading.value = false
  }
}

/** 通过服务端 API 完成 Google 登录认证 */
async function signInViaServer(data: Record<string, string>) {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || 'https://fashion-rec.com'
  const serverRes: any = await new Promise((resolve, reject) => {
    uni.request({
      url: `${apiUrl}/api/auth/google-native`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data,
      success: (res: any) => resolve(res),
      fail: (err: any) => reject(new Error(`服务端认证失败: ${err?.errMsg || JSON.stringify(err)}`)),
    })
  })

  if (serverRes.statusCode !== 200) {
    const errMsg = (serverRes.data as any)?.detail || (serverRes.data as any)?.error || `HTTP ${serverRes.statusCode}`
    throw new Error(`服务端认证失败: ${errMsg}`)
  }

  const { access_token, refresh_token } = serverRes.data as { access_token: string, refresh_token: string }
  console.log('[Login] Server returned session tokens')
  uni.setStorageSync('auth_token', access_token)

  try {
    if (supabase?.auth?.setSession) {
      await supabase.auth.setSession({ access_token, refresh_token })
      console.log('[Login] Supabase session set OK')
    }
  } catch (e) {
    console.warn('[Login] setSession failed, continuing with stored token:', e)
  }

  afterLogin()
}

async function handleGoogleLogin() {
  loading.value = true
  error.value = ''
  try {
    // #ifdef APP-PLUS
    // App 端：使用 uni.login 调起原生 Google 登录
    const loginRes: any = await new Promise((resolve, reject) => {
      uni.login({
        provider: 'google',
        success: (res: any) => resolve(res),
        fail: (err: any) => reject(new Error(`Google 登录失败: ${err?.errMsg || JSON.stringify(err)}`)),
      })
    })
    console.log('[Login] uni.login full result:', JSON.stringify(loginRes))

    const authResult = loginRes.authResult || {}
    let googleAccessToken = authResult.access_token || authResult.accessToken
    let googleIdToken = authResult.idToken || authResult.id_token

    // uni.login 可能只返回 openid，需要通过 getUserInfo 获取完整 token
    if (!googleAccessToken && !googleIdToken) {
      console.log('[Login] No token in loginRes, trying getUserInfo...')
      const userInfoRes: any = await new Promise((resolve, reject) => {
        uni.getUserInfo({
          provider: 'google',
          success: (res: any) => resolve(res),
          fail: (err: any) => reject(new Error(`获取 Google 用户信息失败: ${err?.errMsg || JSON.stringify(err)}`)),
        })
      })
      console.log('[Login] getUserInfo result:', JSON.stringify(userInfoRes))
      const uiAuthResult = userInfoRes.authResult || {}
      googleAccessToken = uiAuthResult.access_token || uiAuthResult.accessToken
      googleIdToken = uiAuthResult.idToken || uiAuthResult.id_token
    }

    // 方式一：优先使用 ID token，直接通过 Supabase signInWithIdToken 认证（无需服务端中转）
    if (googleIdToken) {
      console.log('[Login] Using signInWithIdToken, idToken length:', googleIdToken.length)
      const { data, error: err } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleIdToken,
        access_token: googleAccessToken,
      })
      if (err) throw err
      if (data.session) {
        uni.setStorageSync('auth_token', data.session.access_token)
        console.log('[Login] Supabase session set OK via signInWithIdToken')
        afterLogin()
        return
      }
    }

    // 方式二：使用 access_token 通过服务端换取 Supabase session
    if (googleAccessToken) {
      console.log('[Login] Using access_token via server, token length:', googleAccessToken.length)
      await signInViaServer({ access_token: googleAccessToken })
      return
    }

    // 方式三：uni-app Google 模块未返回 token，但有用户信息（openid + email）
    // 将 Google 验证过的用户信息发送到服务端，由服务端通过 Supabase Admin API 完成认证
    const googleUserId = authResult.openid || authResult.unionid
    if (googleUserId) {
      // 获取用户详细信息
      let userEmail = ''
      let userName = ''
      try {
        const userInfoRes: any = await new Promise((resolve, reject) => {
          uni.getUserInfo({
            provider: 'google',
            success: (res: any) => resolve(res),
            fail: (err: any) => reject(err),
          })
        })
        userEmail = userInfoRes.userInfo?.email || ''
        userName = userInfoRes.userInfo?.nickname || userInfoRes.userInfo?.nickName || ''
        console.log('[Login] Google user info:', { email: userEmail, name: userName, googleUserId })
      } catch (e) {
        console.warn('[Login] getUserInfo for email failed:', e)
      }

      if (!userEmail) {
        throw new Error('未获取到 Google 邮箱，请重试')
      }

      console.log('[Login] Using google user info via server (no token available)')
      await signInViaServer({ email: userEmail, google_user_id: googleUserId, name: userName })
      return
    }

    throw new Error('Google 登录未返回有效信息，请重试')
    // #endif

    // #ifdef H5
    const apiUrl = (import.meta.env.VITE_API_URL as string) || 'https://fashion-rec.com'
    const googleClientId =
      (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
      '729541469608-idf9oamqmk1pg81tl7akt7vns94da57a.apps.googleusercontent.com'

    const session = await signInWithGoogleWeb({
      supabase,
      apiBaseUrl: apiUrl,
      googleClientId,
    })

    uni.setStorageSync('auth_token', session.access_token)
    afterLogin()
    return
    // #endif
  } catch (e: unknown) {
    console.error('[Login] Google login error', e)
    error.value = (e as { message?: string })?.message || t('login.googleLoginFailed')
  } finally {
    loading.value = false
  }
}

async function handleResendConfirmation() {
  if (!email.value) {
    error.value = t('login.pleaseEnterEmailAddress')
    return
  }
  if (resendCooldown.value > 0) return
  loading.value = true
  error.value = ''
  try {
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: email.value,
      options: { emailRedirectTo: getCallbackUrl() },
    })
    if (err) {
      if (err.message?.includes('already confirmed')) {
        error.value = t('login.emailAlreadyConfirmed')
        showResendConfirmation.value = false
      } else if (err.message?.includes('rate limit')) {
        error.value = t('login.tooManyRequests')
      } else throw err
      return
    }
    error.value = t('login.confirmationEmailSent')
    resendCooldown.value = 60
    if (resendTimer) clearInterval(resendTimer)
    resendTimer = setInterval(() => {
      resendCooldown.value--
      if (resendCooldown.value <= 0 && resendTimer) {
        clearInterval(resendTimer)
        resendTimer = null
      }
    }, 1000)
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message || t('login.resendFailed')
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  if (resendTimer) {
    clearInterval(resendTimer)
    resendTimer = null
  }
})
</script>
