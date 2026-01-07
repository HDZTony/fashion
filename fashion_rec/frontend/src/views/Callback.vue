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

    // Handle email confirmation callback
    // Supabase sends confirmation tokens in the URL hash
    const { data, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      // Try to handle the email confirmation token from URL hash
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        // Wait a moment for Supabase to process the token
        await new Promise(resolve => setTimeout(resolve, 500))
        const { data: retryData, error: retryError } = await supabase.auth.getSession()
        if (retryError) throw retryError
        if (retryData.session) {
          localStorage.setItem('auth_token', retryData.session.access_token)
          // Also set cookie for browser-initiated requests
          const { setTokenInCookie } = await import('../lib/cookie-storage')
          setTokenInCookie(retryData.session.access_token)
          router.push('/studio')
          return
        }
      }
      throw sessionError
    }
    
    if (data.session) {
      // Store the access token
      localStorage.setItem('auth_token', data.session.access_token)
      // Also set cookie for browser-initiated requests
      const { setTokenInCookie } = await import('../lib/cookie-storage')
      setTokenInCookie(data.session.access_token)
      
      // Redirect to studio
      router.push('/studio')
    } else {
      error.value = 'No session found. Please check your email confirmation link or try signing in again.'
      setTimeout(() => router.push('/login'), 3000)
    }
  } catch (err: any) {
    console.error('Callback error:', err)
    error.value = err.message || 'Authentication failed'
    setTimeout(() => router.push('/login'), 2000)
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 via-white to-purple-50 p-4 relative overflow-hidden">
    <!-- Decorative background elements -->
    <div class="absolute inset-0 -z-10">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl"></div>
    </div>
    
    <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center border border-pink-100">
      <div v-if="!error">
        <div class="w-16 h-16 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-pink-600 font-medium text-lg">Completing sign-in...</p>
      </div>
      <div v-else class="text-red-600">
        <p class="font-medium mb-2 text-lg">{{ error }}</p>
        <p class="text-sm text-pink-600 mt-2">If you just confirmed your email, please try signing in.</p>
        <p class="text-sm text-pink-600 mt-1">Redirecting to login...</p>
      </div>
    </div>
  </div>
</template>
