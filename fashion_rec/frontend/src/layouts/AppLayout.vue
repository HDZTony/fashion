<template>
  <div class="min-h-screen bg-green-50/20 font-sans text-green-900">
    <nav class="sticky top-0 z-50 w-full border-b border-green-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <router-link to="/" class="flex items-center space-x-2">
          <span class="text-2xl font-bold tracking-tight text-green-800">Fashion Rec</span>
          <!-- Version Badge -->
          <span 
            v-if="!isLoadingVersion && currentVersion" 
            :class="[
              'px-2 py-0.5 text-xs font-semibold rounded-full',
              isV2 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-green-50 text-green-600 border border-green-200'
            ]"
            :title="`Current version: ${currentVersion}`"
          >
            {{ isV2 ? 'V2' : 'Stable' }}
          </span>
        </router-link>
        <div class="flex items-center gap-4">
          <router-link to="/studio" class="text-sm text-green-700 hover:text-green-900 transition-colors">Studio</router-link>
          <router-link to="/wardrobe" class="text-sm text-green-700 hover:text-green-900 transition-colors">Wardrobe</router-link>
          <router-link to="/tryon-history" class="text-sm text-green-700 hover:text-green-900 transition-colors">Outfit History</router-link>
          <router-link to="/favorites" class="text-sm text-green-700 hover:text-green-900 transition-colors flex items-center gap-1">
            <Heart class="w-4 h-4" /> Favorites
          </router-link>
          <router-link to="/profile" class="text-sm text-green-700 hover:text-green-900 transition-colors flex items-center gap-1">
            <User class="w-4 h-4" />
            Profile
          </router-link>
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
import { Heart, User } from 'lucide-vue-next'
import { useVersion } from '@/composables/useVersion'

const { currentVersion, getVersion, isV2, isLoading: isLoadingVersion } = useVersion()

onMounted(async () => {
  await getVersion()
})
</script>

