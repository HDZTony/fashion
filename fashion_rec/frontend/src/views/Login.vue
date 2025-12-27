<script setup lang="ts">
defineOptions({ name: 'Login' })
import { supabase } from '../lib/supabase'
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const message = ref('')
const isSignUp = ref(false)
const isForgotPassword = ref(false)
const resetEmail = ref('')
const showResendConfirmation = ref(false)
const resendCooldown = ref(0)
const resendTimer = ref<ReturnType<typeof setInterval> | null>(null)

const handleLogin = async () => {
  if (!email.value) {
    message.value = 'Please enter your email'
    return
  }
  if (!password.value) {
    message.value = 'Please enter your password'
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    if (isSignUp.value) {
      // 注册新用户
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          emailRedirectTo: `${window.location.origin}/callback`
        }
      })

      if (error) {
        // Handle specific errors
        if (error.message.includes('already registered')) {
          message.value = 'This email is already registered. Please sign in.'
          isSignUp.value = false
        } else {
          throw error
        }
        return
      }

      if (data.user) {
        // Check whether email verification is needed
        if (data.session) {
          // Session present; no verification needed
          message.value = 'Sign-up successful! Signing you in...'
          localStorage.setItem('auth_token', data.session.access_token)
          // Also set cookie for browser-initiated requests
          const { setTokenInCookie } = await import('../lib/cookie-storage')
          setTokenInCookie(data.session.access_token)
          router.push('/wardrobe')
        } else {
          // Verification required
          message.value = 'Sign-up successful! Please check your email (including spam folder) to verify your account.'
          showResendConfirmation.value = true
          // Start cooldown timer (60 seconds)
          resendCooldown.value = 60
          if (resendTimer.value) clearInterval(resendTimer.value)
          resendTimer.value = setInterval(() => {
            resendCooldown.value--
            if (resendCooldown.value <= 0 && resendTimer.value) {
              clearInterval(resendTimer.value)
              resendTimer.value = null
            }
          }, 1000)
        }
      }
    } else {
      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      })

      if (error) {
        // Handle specific errors
        if (error.message.includes('Invalid login credentials')) {
          message.value = 'Incorrect email or password'
        } else if (error.message.includes('Email not confirmed')) {
          message.value = 'Please verify your email first. Check your inbox (including spam folder) for the confirmation email.'
          showResendConfirmation.value = true
          // Start cooldown timer (60 seconds)
          resendCooldown.value = 60
          if (resendTimer.value) clearInterval(resendTimer.value)
          resendTimer.value = setInterval(() => {
            resendCooldown.value--
            if (resendCooldown.value <= 0 && resendTimer.value) {
              clearInterval(resendTimer.value)
              resendTimer.value = null
            }
          }, 1000)
        } else {
          throw error
        }
        return
      }

      if (data.session) {
        // Save token and navigate
        localStorage.setItem('auth_token', data.session.access_token)
        // Also set cookie for browser-initiated requests
        const { setTokenInCookie } = await import('../lib/cookie-storage')
        setTokenInCookie(data.session.access_token)
        router.push('/wardrobe')
      }
    }
  } catch (error: any) {
    console.error('Auth error:', error)
    message.value = error.message || (isSignUp.value ? 'Sign-up failed' : 'Sign-in failed')
  } finally {
    isLoading.value = false
  }
}

const toggleMode = () => {
  isSignUp.value = !isSignUp.value
  isForgotPassword.value = false
  showResendConfirmation.value = false
  message.value = ''
  password.value = ''
  if (resendTimer.value) {
    clearInterval(resendTimer.value)
    resendTimer.value = null
  }
  resendCooldown.value = 0
}

const handleForgotPassword = async () => {
  if (!resetEmail.value) {
    message.value = 'Please enter your email address'
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.value, {
      redirectTo: `${window.location.origin}/callback?type=recovery`
    })

    if (error) throw error

    message.value = 'Password reset email sent. Please check your inbox.'
  } catch (error: any) {
    console.error('Password reset error:', error)
    message.value = error.message || 'Failed to send password reset email'
  } finally {
    isLoading.value = false
  }
}

const showForgotPassword = () => {
  isForgotPassword.value = true
  isSignUp.value = false
  resetEmail.value = email.value || ''
  message.value = ''
  password.value = ''
}

const backToLogin = () => {
  isForgotPassword.value = false
  message.value = ''
}

// Cleanup timer on component unmount
onUnmounted(() => {
  if (resendTimer.value) {
    clearInterval(resendTimer.value)
    resendTimer.value = null
  }
})

const handleResendConfirmation = async () => {
  if (!email.value) {
    message.value = 'Please enter your email address'
    return
  }

  if (resendCooldown.value > 0) {
    message.value = `Please wait ${resendCooldown.value} seconds before resending.`
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.value,
      options: {
        emailRedirectTo: `${window.location.origin}/callback`
      }
    })

    if (error) {
      if (error.message.includes('already confirmed')) {
        message.value = 'This email is already confirmed. Please try signing in.'
        showResendConfirmation.value = false
      } else if (error.message.includes('rate limit')) {
        message.value = 'Too many requests. Please wait a few minutes before trying again.'
      } else {
        throw error
      }
      return
    }

    message.value = 'Confirmation email sent! Please check your inbox (including spam folder).'
    // Start cooldown timer (60 seconds)
    resendCooldown.value = 60
    if (resendTimer.value) clearInterval(resendTimer.value)
    resendTimer.value = setInterval(() => {
      resendCooldown.value--
      if (resendCooldown.value <= 0 && resendTimer.value) {
        clearInterval(resendTimer.value)
        resendTimer.value = null
      }
    }, 1000)
  } catch (error: any) {
    console.error('Resend confirmation error:', error)
    message.value = error.message || 'Failed to resend confirmation email'
  } finally {
    isLoading.value = false
  }
}

const handleGoogleLogin = async () => {
  isLoading.value = true
  message.value = ''

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`
      }
    })

    if (error) {
      throw error
    }
    // User will be redirected to Google, so we don't need to handle success here
  } catch (error: any) {
    console.error('Google login error:', error)
    message.value = error.message || 'Failed to sign in with Google'
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
      <h1 class="text-3xl font-bold mb-2 text-center">Welcome</h1>
      <p class="text-gray-500 mb-8 text-center">
        {{ isForgotPassword ? 'Reset password' : isSignUp ? 'Create account' : 'Sign in to access your AI wardrobe' }}
      </p>
      
      <!-- 密码找回表单 -->
      <div v-if="isForgotPassword" class="space-y-4">
        <input
          v-model="resetEmail"
          type="email"
          placeholder="Enter your email address"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleForgotPassword"
        />
        
        <button 
          @click="handleForgotPassword"
          :disabled="isLoading"
          class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? 'Sending...' : 'Send reset link' }}
        </button>

        <p v-if="message" class="text-sm text-center" :class="message.toLowerCase().includes('sent') ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </p>
        
        <div class="pt-4 border-t border-gray-200">
          <button
            @click="backToLogin"
            class="w-full text-sm text-gray-600 hover:text-black transition-colors"
          >
            ← 返回登录
          </button>
        </div>
      </div>

      <!-- 登录/注册表单 -->
      <div v-else class="space-y-4">
        <input
          v-model="email"
          type="email"
          placeholder="Enter email"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleLogin"
        />
        
        <input
          v-model="password"
          type="password"
          placeholder="Enter password"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleLogin"
        />
        
        <div class="flex justify-end">
          <button
            @click="showForgotPassword"
            class="text-sm text-gray-600 hover:text-black transition-colors"
          >
            Forgot password?
          </button>
        </div>
        
        <button 
          @click="handleLogin"
          :disabled="isLoading"
          class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? (isSignUp ? 'Signing up...' : 'Signing in...') : (isSignUp ? 'Sign up' : 'Sign in') }}
        </button>

        <!-- Divider -->
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <!-- Google Login Button -->
        <button 
          @click="handleGoogleLogin"
          :disabled="isLoading"
          class="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <p v-if="message" class="text-sm text-center" :class="message.toLowerCase().includes('success') || message.toLowerCase().includes('sent') ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </p>

        <!-- 重新发送确认邮件按钮 -->
        <div v-if="showResendConfirmation" class="pt-2">
          <button
            @click="handleResendConfirmation"
            :disabled="isLoading || resendCooldown > 0"
            class="w-full text-sm text-gray-600 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed underline"
          >
            {{ resendCooldown > 0 
              ? `Resend confirmation email (wait ${resendCooldown}s)` 
              : 'Didn\'t receive the email? Resend confirmation' }}
          </button>
        </div>
        
        <div class="pt-4 border-t border-gray-200">
          <button
            @click="toggleMode"
            class="w-full text-sm text-gray-600 hover:text-black transition-colors"
          >
            {{ isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up' }}
          </button>
        </div>
      </div>
      
      <!-- Footer Links -->
      <div class="mt-6 pt-4 border-t border-gray-200 flex justify-center gap-4 text-xs text-gray-500">
        <router-link to="/privacy-policy" class="hover:text-black transition-colors">
          Privacy Policy
        </router-link>
        <span class="text-gray-300">|</span>
        <router-link to="/terms-of-service" class="hover:text-black transition-colors">
          Terms of Service
        </router-link>
      </div>
    </div>
  </div>
</template>
