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
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
      <h1 class="text-3xl font-bold mb-2 text-center">Reset Password</h1>
      <p class="text-gray-500 mb-8 text-center">Enter your new password</p>
      
      <div v-if="isValidToken" class="space-y-4">
        <input
          v-model="password"
          type="password"
          placeholder="Enter new password (min 6 characters)"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleResetPassword"
        />
        
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
          @keyup.enter="handleResetPassword"
        />
        
        <button 
          @click="handleResetPassword"
          :disabled="isLoading"
          class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? 'Resetting...' : 'Reset password' }}
        </button>

        <p v-if="message" class="text-sm text-center" :class="message.toLowerCase().includes('successful') ? 'text-green-600' : 'text-red-600'">
          {{ message }}
        </p>
      </div>
      
      <div v-else class="text-center">
        <div class="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-red-600 mb-2">{{ message || 'Validating reset link...' }}</p>
        <p class="text-sm text-gray-500">Redirecting to sign-in page</p>
      </div>
    </div>
  </div>
</template>

