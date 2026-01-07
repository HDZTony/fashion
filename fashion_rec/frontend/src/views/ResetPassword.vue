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
      message.value = 'The reset link is invalid or expired. Please request again.'
      setTimeout(() => router.push('/login'), 3000)
    }
  } catch (err: any) {
    console.error('Session check error:', err)
    message.value = 'Unable to verify reset link. Please request a new one.'
    setTimeout(() => router.push('/login'), 3000)
  }
})

const handleResetPassword = async () => {
  if (!password.value) {
    message.value = 'Please enter a new password'
    return
  }
  
  if (password.value.length < 6) {
    message.value = 'Password must be at least 6 characters'
    return
  }
  
  if (password.value !== confirmPassword.value) {
    message.value = 'Passwords do not match'
    return
  }

  isLoading.value = true
  message.value = ''

  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value
    })

    if (error) throw error

    message.value = 'Password reset successful! Redirecting to sign in...'
    
    // Clear session and redirect to login
    await supabase.auth.signOut()
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (error: any) {
    console.error('Password reset error:', error)
    message.value = error.message || 'Password reset failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-purple-50 p-4 relative overflow-hidden">
    <!-- Decorative background elements -->
    <div class="absolute inset-0 -z-10">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl"></div>
    </div>
    
    <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-pink-100">
      <h1 class="text-4xl font-bold mb-2 text-center bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
        Reset Password
      </h1>
      <p class="text-gray-600 mb-8 text-center text-lg">Enter your new password</p>
      
      <div v-if="isValidToken" class="space-y-4">
        <input
          v-model="password"
          type="password"
          placeholder="Enter new password (min 6 characters)"
          class="w-full px-4 py-3 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 transition-all"
          @keyup.enter="handleResetPassword"
        />
        
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          class="w-full px-4 py-3 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-400 transition-all"
          @keyup.enter="handleResetPassword"
        />
        
        <button 
          @click="handleResetPassword"
          :disabled="isLoading"
          class="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-3 rounded-full font-semibold hover:from-pink-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
        >
          {{ isLoading ? 'Resetting...' : 'Reset password' }}
        </button>

        <p v-if="message" class="text-sm text-center font-medium" :class="message.toLowerCase().includes('successful') ? 'text-pink-600' : 'text-red-600'">
          {{ message }}
        </p>
      </div>
      
      <div v-else class="text-center">
        <div class="w-16 h-16 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-red-600 mb-2 font-medium">{{ message || 'Validating reset link...' }}</p>
        <p class="text-sm text-pink-600">Redirecting to sign-in page</p>
      </div>
    </div>
  </div>
</template>

