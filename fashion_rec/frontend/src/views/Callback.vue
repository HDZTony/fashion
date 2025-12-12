<script setup lang="ts">
defineOptions({ name: 'Callback' })
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()
const route = useRoute()
const error = ref('')
const isPasswordReset = ref(false)

onMounted(async () => {
  try {
    // Check if this is a password reset callback
    // Supabase password reset links include #access_token and #type=recovery in the hash
    const hash = window.location.hash
    const hashParams = new URLSearchParams(hash.substring(1))
    const type = route.query.type as string || hashParams.get('type')
    
    if (type === 'recovery' || hash.includes('type=recovery')) {
      // This is a password reset callback
      isPasswordReset.value = true
      // Preserve the hash for password reset
      router.push(`/reset-password${hash}`)
      return
    }

    // Get the session after the OAuth redirect
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) throw sessionError
    
    if (session) {
      // Store the access token
      localStorage.setItem('auth_token', session.access_token)
      
      // Redirect to studio
      router.push('/studio')
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
