<script setup lang="ts">
defineOptions({ name: 'ResetPassword' })
import { supabase } from '../lib/supabase'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const message = ref('')
const isValidToken = ref(false)

onMounted(async () => {
  // Check if we have a valid session (from password reset link)
  // Supabase password reset links include access_token in the hash
  try {
    // First, try to get session from the hash (if coming from callback)
    const hash = window.location.hash
    if (hash) {
      // The hash contains the access_token, Supabase will handle it
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      
      if (session) {
        isValidToken.value = true
        return
      }
    }
    
    // If no hash, check existing session
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    
    if (session) {
      isValidToken.value = true
    } else {
      message.value = '密码重置链接无效或已过期，请重新申请'
      setTimeout(() => router.push('/login'), 3000)
    }
  } catch (err: any) {
    console.error('Session check error:', err)
    message.value = '无法验证重置链接，请重新申请'
    setTimeout(() => router.push('/login'), 3000)
  }
})

const handleResetPassword = async () => {
  if (!password.value) {
    message.value = '请输入新密码'
    return
  }
  
  if (password.value.length < 6) {
    message.value = '密码长度至少为6位'
    return
  }
  
  if (password.value !== confirmPassword.value) {
    message.value = '两次输入的密码不一致'
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value
    })

    if (error) throw error

    message.value = '密码重置成功！正在跳转到登录页面...'
    
    // Clear session and redirect to login
    await supabase.auth.signOut()
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (error: any) {
    console.error('Password reset error:', error)
    message.value = error.message || '密码重置失败'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
      <h1 class="text-3xl font-bold mb-2 text-center">重置密码</h1>
      <p class="text-gray-500 mb-8 text-center">请输入您的新密码</p>
      
      <div v-if="isValidToken" class="space-y-4">
        <input
          v-model="password"
          type="password"
          placeholder="输入新密码（至少6位）"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleResetPassword"
        />
        
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="确认新密码"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleResetPassword"
        />
        
        <button 
          @click="handleResetPassword"
          :disabled="isLoading"
          class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? '重置中...' : '重置密码' }}
        </button>

        <p v-if="message" class="text-sm text-center" :class="message.includes('成功') ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </p>
      </div>
      
      <div v-else class="text-center">
        <div class="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-red-600 mb-2">{{ message || '正在验证重置链接...' }}</p>
        <p class="text-sm text-gray-500">即将跳转到登录页面</p>
      </div>
    </div>
  </div>
</template>

