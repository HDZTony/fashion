<script setup lang="ts">
defineOptions({ name: 'Login' })
import { supabase } from '../lib/supabase'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const message = ref('')
const isSignUp = ref(false)
const isForgotPassword = ref(false)
const resetEmail = ref('')

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
          router.push('/wardrobe')
        } else {
          // Verification required
          message.value = 'Sign-up successful! Please check your email to verify your account.'
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
          message.value = 'Please verify your email first'
        } else {
          throw error
        }
        return
      }

      if (data.session) {
        // Save token and navigate
        localStorage.setItem('auth_token', data.session.access_token)
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
  message.value = ''
  password.value = ''
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

        <p v-if="message" class="text-sm text-center" :class="message.toLowerCase().includes('success') ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </p>
        
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
