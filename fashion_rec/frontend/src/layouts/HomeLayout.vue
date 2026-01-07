<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { Mail } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

const handleGetStarted = () => {
  if (isAuthenticated.value) {
    router.push('/studio')
  } else {
    router.push('/login')
  }
}

const buttonText = computed(() => {
  return isAuthenticated.value ? 'Enter Studio' : 'Start for Free'
})
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Sticky Navigation Bar -->
    <nav class="sticky top-0 z-50 w-full border-b border-pink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <!-- Logo/Brand -->
        <router-link to="/" class="flex items-center space-x-2">
          <span class="text-2xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Fashion Rec</span>
        </router-link>

        <!-- Right side - Get Started Button -->
        <div class="flex items-center">
          <router-link
            to="/pricing"
            class="text-sm text-pink-600 hover:text-pink-700 font-semibold flex items-center gap-1 mr-4 transition-colors"
          >
            Pricing
          </router-link>
          <a
            href="mailto:support@hdz73.com"
            class="text-sm text-pink-600 hover:text-pink-700 font-semibold flex items-center gap-1 mr-4 transition-colors"
          >
            <Mail class="w-4 h-4" />
            Contact Us
          </a>
          <Button @click="handleGetStarted" variant="default" size="lg" class="font-bold text-base px-6 py-3 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white border-0">
            {{ buttonText }}
          </Button>
        </div>
      </div>
    </nav>

    <!-- Main Content Area -->
    <router-view />
  </div>
</template>

<style scoped>
/* Keep navigation bar visible while scrolling */
nav {
  position: sticky;
  top: 0;
  z-index: 50;
}
</style>

