<script setup>
import { useAuthState } from './composables/useAuthState'

// Initialize auth state globally at app startup
// This ensures token is synced to localStorage immediately after login,
// before any component interceptors need it (especially important for page refresh scenarios)
// This is critical for TryOnHistory and Favorites pages which rely on localStorage backup token
useAuthState()
</script>

<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>
