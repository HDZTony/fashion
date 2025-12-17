<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <nav class="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <router-link to="/" class="flex items-center space-x-2">
          <span class="text-2xl font-bold tracking-tight">Fashion Rec</span>
        </router-link>
        <div class="flex items-center gap-4">
          <router-link to="/studio" class="text-sm text-gray-600 hover:text-black">Studio</router-link>
          <router-link to="/wardrobe" class="text-sm text-gray-600 hover:text-black">Wardrobe</router-link>
          <router-link to="/history" class="text-sm text-gray-600 hover:text-black">Outfit History</router-link>
          <router-link to="/favorites" class="text-sm text-gray-600 hover:text-black flex items-center gap-1">
            <Heart class="w-4 h-4" /> Favorites
          </router-link>
          <router-link to="/tryon-history" class="text-sm text-gray-600 hover:text-black flex items-center gap-1">
            <History class="w-4 h-4" /> Try-On History
          </router-link>
          <router-link to="/profile" class="text-sm text-gray-600 hover:text-black flex items-center gap-1">
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
import { Heart, History, User } from 'lucide-vue-next'
</script>

