<script setup lang="ts">
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://openauth-reticollabo.hedz.workers.dev' // User needs to set this

const login = () => {
  // Redirect to OpenAuth authorize endpoint
  // client_id and redirect_uri must match what's configured in the worker
  const redirectUri = `${window.location.origin}/callback`
  window.location.href = `${AUTH_URL}/authorize?client_id=fashion-app&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
      <h1 class="text-3xl font-bold mb-2">Welcome</h1>
      <p class="text-gray-500 mb-8">Sign in to access your AI Wardrobe</p>
      
      <button 
        @click="login"
        class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
      >
        Sign in with OpenAuth
      </button>
    </div>
  </div>
</template>
