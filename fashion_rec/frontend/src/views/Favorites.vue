<script setup lang="ts">
defineOptions({ name: 'Favorites' })
import { onMounted, onUnmounted, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { Heart, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next'
import { apiClient } from '../lib/api-client'

const { t } = useI18n()

const router = useRouter()
const authStore = useAuthStore()

// Ensure token is synced when component is activated (for keep-alive scenarios)
onActivated(async () => {
  // Refresh session to ensure token is synced to localStorage
  // This handles cases where the component was cached by keep-alive
  // and the session might have changed or expired
  try {
    await authStore.refreshSession()
  } catch (e) {
    console.warn('[Favorites] Failed to refresh session on activated:', e)
  }
})

interface Favorite {
  id: string
  image_url: string
  title?: string
  garment_urls?: string[]
  scene_image_url?: string
  prompt?: string
  model_image_url?: string
  model_image_id?: string
  created_at: string
}

const favorites = ref<Favorite[]>([])
const isLoading = ref(false)
const error = ref('')
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])

// Cache management for page refresh
const saveFavoritesToCache = () => {
  try {
    sessionStorage.setItem('favorites_cache', JSON.stringify(favorites.value))
  } catch (e) {
    console.warn('[Favorites] Failed to save favorites to cache:', e)
  }
}

const restoreFavoritesFromCache = () => {
  try {
    const cached = sessionStorage.getItem('favorites_cache')
    if (cached) {
      const items = JSON.parse(cached)
      if (Array.isArray(items) && items.length > 0) {
        favorites.value = items
        console.log('[Favorites] Restored favorites from cache:', items.length, 'items')
        return true
      }
    }
  } catch (e) {
    console.warn('[Favorites] Failed to restore favorites from cache:', e)
  }
  return false
}

// Use unified API client from api-client.ts
// The unified client already handles authentication, retries, and token refresh

const loadFavorites = async () => {
  // Prevent duplicate concurrent calls
  if (isLoading.value) {
    return
  }
  
  isLoading.value = true
  error.value = ''
  try {
    const response = await apiClient.get<{ favorites: Favorite[] }>('/favorites')
    favorites.value = response.data.favorites || []
    // Save to cache for next page refresh
    saveFavoritesToCache()
  } catch (e: any) {
    console.error('Failed to load favorites:', e)
    const errorDetail = e?.response?.data?.detail || e?.message || 'Failed to load favorites'
    
    // If authentication failed, don't show error if we have cached data
    if (e?.response?.status === 401 || errorDetail.includes('Not authenticated') || errorDetail.includes('authenticated')) {
      if (favorites.value.length > 0) {
        console.log('[Favorites] API failed but using cached data')
        error.value = '' // Clear error if we have cached data
        return
      }
    }
    
    // Only show error if we don't have cached data
    if (favorites.value.length === 0) {
      error.value = errorDetail
    } else {
      console.log('[Favorites] API failed but using cached data, hiding error')
      error.value = '' // Clear error if we have cached data
    }
  } finally {
    isLoading.value = false
  }
}

const deleteFavorite = async (favoriteId: string) => {
  if (!confirm(t('favorites.deleteConfirm'))) {
    return
  }
  
  try {
    await apiClient.delete(`/favorites/${favoriteId}`)
    await loadFavorites()
  } catch (e: any) {
    console.error('Failed to delete favorite:', e)
    alert(e?.response?.data?.detail || e?.message || 'Delete failed')
  }
}

const openImageViewer = (index: number) => {
  imageViewerImages.value = favorites.value
    .map(f => f.image_url)
    .filter((url): url is string => !!url)
  
  if (imageViewerImages.value.length === 0) return
  
  currentImageIndex.value = index
  showImageViewer.value = true
}

const closeImageViewer = () => {
  showImageViewer.value = false
  imageViewerImages.value = []
  currentImageIndex.value = 0
}

const nextImage = () => {
  if (currentImageIndex.value < imageViewerImages.value.length - 1) {
    currentImageIndex.value++
  } else {
    currentImageIndex.value = 0
  }
}

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  } else {
    currentImageIndex.value = imageViewerImages.value.length - 1
  }
}

// Keyboard navigation
const handleKeyDown = (event: KeyboardEvent) => {
  if (!showImageViewer.value) return
  
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prevImage()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    nextImage()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeImageViewer()
  }
}

onMounted(async () => {
  // Restore from cache first for instant display
  restoreFavoritesFromCache()
  await loadFavorites()
  window.addEventListener('keydown', handleKeyDown)
})

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`
      }
      return `${diffHours} hours ago`
    } else if (diffDays === 1) {
      return 'yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  } catch {
    return dateString
  }
}

// Restore favorite to Studio page
const restoreFavorite = async (favorite: Favorite) => {
  try {
    // Save favorite data to sessionStorage for Studio page to restore
    const restoreData = {
      tryonHistoryId: favorite.id,
      image_url: favorite.image_url,
      garment_urls: favorite.garment_urls || [],
      scene_image_url: favorite.scene_image_url,
      prompt: favorite.prompt,
      model_image_url: favorite.model_image_url,
      model_image_id: favorite.model_image_id,
      created_at: favorite.created_at,
    }
    
    sessionStorage.setItem('tryon_history_restore', JSON.stringify(restoreData))
    
    // Navigate to Studio page with query parameter
    router.push({
      path: '/studio',
      query: { tryonHistoryId: favorite.id }
    })
  } catch (error: any) {
    console.error('Failed to restore favorite:', error)
    alert(t('favorites.restoreFailed'))
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between">
      <h1 class="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
        <Heart class="w-6 h-6 text-pink-600 fill-current" />
        {{ $t('favorites.title') }}
      </h1>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
      <div
        v-if="isLoading"
        class="py-12 flex flex-col items-center justify-center"
      >
        <div class="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-pink-700 font-medium">{{ $t('favorites.loading') }}</p>
      </div>

      <div v-else-if="error" class="py-8 text-center text-red-600 text-sm">
        {{ error }}
      </div>

      <div v-else-if="!favorites.length" class="py-12 text-center">
        <Heart class="w-16 h-16 mx-auto mb-4 text-pink-300" />
        <p class="text-gray-700 text-sm mb-2 font-medium">{{ $t('favorites.noFavorites') }}</p>
        <p class="text-pink-600 text-xs">{{ $t('favorites.noFavoritesDesc') }}</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="(favorite, index) in favorites"
          :key="favorite.id"
          class="bg-white border border-pink-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
        >
          <!-- Image -->
          <div
            @click="openImageViewer(index)"
            class="aspect-square bg-gray-100 cursor-pointer overflow-hidden relative"
          >
            <img
              :src="favorite.image_url"
              :alt="favorite.title || 'Favorite'"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
          </div>
          
          <!-- Content -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex-1">
                <p class="text-xs text-pink-400 mb-1">
                  {{ formatDate(favorite.created_at) }}
                </p>
                <p v-if="favorite.garment_urls && favorite.garment_urls.length > 0" class="text-xs text-pink-500">
                  {{ favorite.garment_urls.length }} {{ $t('favorites.items') }}
                </p>
                <p v-if="favorite.scene_image_url" class="text-xs text-pink-600 mt-1">
                  {{ $t('favorites.includesScene') }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  @click.stop="restoreFavorite(favorite)"
                  class="flex-shrink-0 w-7 h-7 rounded-full hover:bg-pink-50 flex items-center justify-center transition-colors group"
                  :title="$t('favorites.restoreToTryOn')"
                >
                  <RotateCcw class="w-4 h-4 text-pink-400 group-hover:text-pink-600 transition-colors" />
                </button>
                <button
                  @click.stop="deleteFavorite(favorite.id)"
                  class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                  :title="$t('favorites.delete')"
                >
                  <X class="w-4 h-4 text-pink-400 group-hover:text-red-500 transition-colors" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Image Viewer Modal -->
    <div
      v-if="showImageViewer && imageViewerImages.length > 0"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      @click.self="closeImageViewer"
    >
      <div class="relative w-full h-full flex items-center justify-center p-4">
        <!-- Close button -->
        <button
          @click="closeImageViewer"
          class="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
        >
          <X class="w-6 h-6" />
        </button>
        
        <!-- Previous button -->
        <button
          v-if="imageViewerImages.length > 1"
          @click="prevImage"
          class="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
        >
          <ChevronLeft class="w-6 h-6" />
        </button>
        
        <!-- Image -->
        <div class="max-w-4xl max-h-[90vh] flex items-center justify-center">
          <img
            :src="imageViewerImages[currentImageIndex]"
            alt="Favorite"
            class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
        
        <!-- Next button -->
        <button
          v-if="imageViewerImages.length > 1"
          @click="nextImage"
          class="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
        >
          <ChevronRight class="w-6 h-6" />
        </button>
        
        <!-- Image counter -->
        <div
          v-if="imageViewerImages.length > 1"
          class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm"
        >
          {{ currentImageIndex + 1 }} / {{ imageViewerImages.length }}
        </div>
      </div>
    </div>
  </div>
</template>

