<script setup lang="ts">
defineOptions({ name: 'Favorites' })
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { Heart, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next'

const router = useRouter()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

// Use simple axios client like Studio and Wardrobe do (not createAuthenticatedApiClient)
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add interceptor to inject auth token from Supabase session
// This ensures tokens are automatically attached to all requests, even after page refresh
apiClient.interceptors.request.use(async (config) => {
  try {
    // First, try to get session from Supabase (primary source)
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
      return config
    }
    
    // Fallback: if Supabase session is not available (e.g., during page refresh),
    // try to get token from localStorage (backup from useAuthState)
    const backupToken = localStorage.getItem('auth_token')
    if (backupToken) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${backupToken}`
      console.log('[Favorites] Using backup token from localStorage')
      return config
    }
    
    console.warn('[Favorites] No auth token available from Supabase or localStorage')
  } catch (e) {
    console.warn('[Favorites] Failed to get Supabase session for request:', e)
    // Last resort: try localStorage backup even on error
    const backupToken = localStorage.getItem('auth_token')
    if (backupToken) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${backupToken}`
      console.log('[Favorites] Using backup token from localStorage after error')
    }
  }
  return config
})

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
if (!confirm('Delete this favorite?')) {
    return
  }
  
  try {
    // Manually get session and set header like Profile.vue does
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    
    if (!token) {
      throw new Error('No authentication token available')
    }
    
    await apiClient.delete(`/favorites/${favoriteId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
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
  // Restore from cache first for instant display (before waiting for session)
  restoreFavoritesFromCache()
  
  // Ensure session is loaded before making requests (handles page refresh)
  try {
    let attempts = 0
    let session = null
    const maxAttempts = 10 // Increased attempts for page refresh scenarios
    const baseDelay = 100 // Base delay in ms
    
    // Retry with exponential backoff to allow Supabase session to recover on page refresh
    while (attempts < maxAttempts && !session) {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.warn(`[Favorites] Attempt ${attempts + 1}/${maxAttempts} - Failed to get session:`, error)
        if (attempts < maxAttempts - 1) {
          const delay = baseDelay * Math.min(attempts + 1, 5)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        attempts++
        continue
      }
      
      if (data.session?.access_token) {
        session = data.session
        if (attempts > 0) {
          console.log(`[Favorites] Session recovered after ${attempts + 1} attempt(s)`)
        }
        break
      }
      
      if (attempts < maxAttempts - 1) {
        // Exponential backoff: wait longer on later attempts
        const delay = baseDelay * Math.min(attempts + 1, 5)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      attempts++
    }
    
    if (!session || !session.access_token) {
      console.warn('[Favorites] No valid session after retries')
      // Don't redirect if we have cached data - user can still see their favorites
      if (favorites.value.length === 0) {
        router.push('/login')
        return
      } else {
        console.log('[Favorites] Using cached data, skipping API calls')
        return
      }
    }
    
    // Ensure token is available before making any API calls
    // Wait a bit more to ensure Supabase client is fully initialized
    await new Promise(resolve => setTimeout(resolve, 150))
    
  } catch (e) {
    console.error('[Favorites] Failed to check session:', e)
    // Don't redirect if we have cached data
    if (favorites.value.length === 0) {
      router.push('/login')
      return
    } else {
      console.log('[Favorites] Using cached data after error, skipping API calls')
      return
    }
  }
  
  loadFavorites()
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
    alert('Failed to restore favorite. Please try again.')
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Heart class="w-6 h-6 text-red-500 fill-current" />
        My Favorites
      </h1>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
      <div
        v-if="isLoading"
        class="py-12 flex flex-col items-center justify-center"
      >
        <div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-gray-500">Loading favorites...</p>
      </div>

      <div v-else-if="error" class="py-8 text-center text-red-600 text-sm">
        {{ error }}
      </div>

      <div v-else-if="!favorites.length" class="py-12 text-center">
        <Heart class="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p class="text-gray-500 text-sm mb-2">No try-on results saved yet</p>
        <p class="text-gray-400 text-xs">After you try on looks, tap Favorite to save what you like.</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="(favorite, index) in favorites"
          :key="favorite.id"
          class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
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
                <p class="text-xs text-gray-400 mb-1">
                  {{ formatDate(favorite.created_at) }}
                </p>
                <p v-if="favorite.garment_urls && favorite.garment_urls.length > 0" class="text-xs text-gray-500">
                  {{ favorite.garment_urls.length }} item(s)
                </p>
                <p v-if="favorite.scene_image_url" class="text-xs text-blue-500 mt-1">
                  包含场景
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  @click.stop="restoreFavorite(favorite)"
                  class="flex-shrink-0 w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center transition-colors group"
                  title="恢复到此试穿"
                >
                  <RotateCcw class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </button>
                <button
                  @click.stop="deleteFavorite(favorite.id)"
                  class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                  title="删除收藏"
                >
                  <X class="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
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

