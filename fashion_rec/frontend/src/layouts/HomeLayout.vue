<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { Mail } from 'lucide-vue-next'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
const isAuthenticated = computed(() => authStore.isAuthenticated)

const handleGetStarted = () => {
  if (isAuthenticated.value) {
    router.push('/studio')
  } else {
    router.push('/login')
  }
}

const buttonText = computed(() => {
  return isAuthenticated.value ? t('home.enterStudio') : t('home.startForFree')
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
          <router-link
            to="/blog"
            class="text-sm text-pink-600 hover:text-pink-700 font-semibold mr-4 transition-colors"
          >
            {{ $t('nav.blog') }}
          </router-link>
          <a
            href="mailto:support@fashion-rec.com"
            class="text-sm text-pink-600 hover:text-pink-700 font-semibold flex items-center gap-1 mr-4 transition-colors"
          >
            <Mail class="w-4 h-4" />
            Contact Us
          </a>
          <LanguageSwitcher class="mr-4" />
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

