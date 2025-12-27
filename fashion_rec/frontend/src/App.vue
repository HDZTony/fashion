<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'

// CRITICAL: Initialize auth store on app mount to ensure token is available
// This is especially important for page refresh scenarios
onMounted(async () => {
  const authStore = useAuthStore()
  
  // If store is still loading, wait for it to complete
  // This ensures token is available before any components make requests
  if (authStore.isLoading) {
    console.log('[App] Waiting for auth store to initialize...')
    await authStore.loadSession()
    console.log('[App] Auth store initialized, token available:', !!authStore.accessToken)
  } else {
    console.log('[App] Auth store already initialized, token available:', !!authStore.accessToken)
  }
})
</script>

<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
