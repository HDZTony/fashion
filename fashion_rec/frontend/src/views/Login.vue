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
    message.value = '请输入邮箱'
    return
  }
  if (!password.value) {
    message.value = '请输入密码'
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
        // 处理特定错误
        if (error.message.includes('already registered')) {
          message.value = '该邮箱已被注册，请直接登录'
          isSignUp.value = false
        } else {
          throw error
        }
        return
      }

      if (data.user) {
        // 检查是否需要邮箱验证
        if (data.session) {
          // 如果直接返回session，说明不需要验证，直接登录
          message.value = '注册成功！正在登录...'
          localStorage.setItem('auth_token', data.session.access_token)
          router.push('/wardrobe')
        } else {
          // 需要邮箱验证
          message.value = '注册成功！请检查您的邮箱以验证账户'
        }
      }
    } else {
      // 登录
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      })

      if (error) {
        // 处理特定错误
        if (error.message.includes('Invalid login credentials')) {
          message.value = '邮箱或密码错误'
        } else if (error.message.includes('Email not confirmed')) {
          message.value = '请先验证您的邮箱'
        } else {
          throw error
        }
        return
      }

      if (data.session) {
        // 保存token并跳转
        localStorage.setItem('auth_token', data.session.access_token)
        router.push('/wardrobe')
      }
    }
  } catch (error: any) {
    console.error('Auth error:', error)
    message.value = error.message || (isSignUp.value ? '注册失败' : '登录失败')
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
    message.value = '请输入邮箱地址'
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.value, {
      redirectTo: `${window.location.origin}/callback?type=recovery`
    })

    if (error) throw error

    message.value = '密码重置邮件已发送，请检查您的邮箱'
  } catch (error: any) {
    console.error('Password reset error:', error)
    message.value = error.message || '发送密码重置邮件失败'
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
        {{ isForgotPassword ? '重置密码' : isSignUp ? '创建账户' : '登录以访问您的AI衣橱' }}
      </p>
      
      <!-- 密码找回表单 -->
      <div v-if="isForgotPassword" class="space-y-4">
        <input
          v-model="resetEmail"
          type="email"
          placeholder="输入您的邮箱地址"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleForgotPassword"
        />
        
        <button 
          @click="handleForgotPassword"
          :disabled="isLoading"
          class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? '发送中...' : '发送重置链接' }}
        </button>

        <p v-if="message" class="text-sm text-center" :class="message.includes('已发送') ? 'text-green-600' : 'text-red-600'">
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
          placeholder="输入邮箱"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleLogin"
        />
        
        <input
          v-model="password"
          type="password"
          placeholder="输入密码"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleLogin"
        />
        
        <div class="flex justify-end">
          <button
            @click="showForgotPassword"
            class="text-sm text-gray-600 hover:text-black transition-colors"
          >
            忘记密码？
          </button>
        </div>
        
        <button 
          @click="handleLogin"
          :disabled="isLoading"
          class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? (isSignUp ? '注册中...' : '登录中...') : (isSignUp ? '注册' : '登录') }}
        </button>

        <p v-if="message" class="text-sm text-center" :class="message.includes('成功') ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </p>
        
        <div class="pt-4 border-t border-gray-200">
          <button
            @click="toggleMode"
            class="w-full text-sm text-gray-600 hover:text-black transition-colors"
          >
            {{ isSignUp ? '已有账户？点击登录' : '没有账户？点击注册' }}
          </button>
        </div>
      </div>
      
      <!-- Footer Links -->
      <div class="mt-6 pt-4 border-t border-gray-200 flex justify-center gap-4 text-xs text-gray-500">
        <router-link to="/privacy-policy" class="hover:text-black transition-colors">
          隐私政策
        </router-link>
        <span class="text-gray-300">|</span>
        <router-link to="/terms-of-service" class="hover:text-black transition-colors">
          服务条款
        </router-link>
      </div>
    </div>
  </div>
</template>
