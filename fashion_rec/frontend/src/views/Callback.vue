<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()
const error = ref('')

onMounted(async () => {
  try {
    // Get the session after the OAuth redirect
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) throw sessionError
    
    if (session) {
      // Store the access token
      localStorage.setItem('auth_token', session.access_token)
      
      // Redirect to home
      router.push('/')
    } else {
      error.value = 'No session found'
      setTimeout(() => router.push('/login'), 2000)
    }
  } catch (err: any) {
    console.error('Callback error:', err)
    error.value = err.message || 'Authentication failed'
    setTimeout(() => router.push('/login'), 2000)
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
      <div v-if="!error">
        <div class="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600">Completing sign-in...</p>
      </div>
      <div v-else class="text-red-600">
        <p class="font-medium mb-2">{{ error }}</p>
        <p class="text-sm text-gray-500">Redirecting to login...</p>
      </div>
    </div>
  </div>
</template>
