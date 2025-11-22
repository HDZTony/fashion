<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(async () => {
  const code = route.query.code as string | undefined
  if (code) {
    try {
      // In a real OAuth flow, we would exchange the code for a token via our backend
      // But for this simple OpenAuth demo, the worker might return the token directly or we simulate it
      // If the OpenAuth worker returns a code, we usually need to exchange it.
      // However, to keep it simple and consistent with the "microservice" advice:
      // We will treat the 'code' as the session token for now, OR we assume the implicit flow if we changed response_type.
      // BUT, standard flow is: Frontend -> Backend (exchange code) -> Auth Server.
      
      // For this demo, let's assume we send the code to OUR backend to verify and get a session.
      // OR, if we want to be stateless, we might just use the code/token provided.
      
      // Let's store the code as a mock token for now to pass the AuthGuard
      localStorage.setItem('auth_token', code)
      router.push('/')
    } catch (e) {
      console.error('Login failed', e)
      alert('Login failed')
      router.push('/login')
    }
  } else {
    router.push('/login')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-gray-500">Completing sign in...</p>
    </div>
  </div>
</template>
