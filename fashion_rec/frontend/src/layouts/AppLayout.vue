<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <nav class="sticky top-0 z-50 w-full border-b border-pink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <router-link to="/" class="flex items-center space-x-2">
          <span class="text-2xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Fashion Rec</span>
          <!-- Version Badge -->
          <span 
            v-if="!isLoadingVersion && currentVersion" 
            :class="[
              'px-2 py-0.5 text-xs font-semibold rounded-full',
              isV2 
                ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                : 'bg-purple-50 text-purple-600 border border-purple-200'
            ]"
            :title="`Current version: ${currentVersion}`"
          >
            {{ isV2 ? 'V2' : 'Stable' }}
          </span>
        </router-link>
        <div class="flex items-center gap-4">
          <router-link to="/studio" class="text-sm text-pink-600 hover:text-pink-700 transition-colors font-medium">{{ $t('nav.studio') }}</router-link>
          <router-link to="/wardrobe" class="text-sm text-pink-600 hover:text-pink-700 transition-colors font-medium">{{ $t('nav.wardrobe') }}</router-link>
          <router-link to="/tryon-history" class="text-sm text-pink-600 hover:text-pink-700 transition-colors font-medium">{{ $t('nav.history') }}</router-link>
          <router-link to="/favorites" class="text-sm text-pink-600 hover:text-pink-700 transition-colors flex items-center gap-1 font-medium">
            <Heart class="w-4 h-4" /> {{ $t('nav.favorites') }}
          </router-link>
          <a href="mailto:support@fashion-rec.com" class="text-sm text-pink-600 hover:text-pink-700 transition-colors flex items-center gap-1 font-medium">
            <Mail class="w-4 h-4" />
            Contact Us
          </a>
          <router-link to="/profile" class="text-sm text-pink-600 hover:text-pink-700 transition-colors flex items-center gap-1 font-medium">
            <User class="w-4 h-4" />
            {{ $t('nav.profile') }}
          </router-link>
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Heart, User, Mail } from 'lucide-vue-next'
import { useVersion } from '@/composables/useVersion'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'

const { currentVersion, getVersion, isV2, isLoading: isLoadingVersion } = useVersion()

onMounted(async () => {
  await getVersion()
})
</script>

