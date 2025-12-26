<script setup lang="ts">
defineOptions({ name: 'TryOnHistory' })
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { History, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next'

const router = useRouter()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SUBSCRIPTION_API_URL = import.meta.env.VITE_SUBSCRIPTION_API_URL || 'http://localhost:3001'

// Use simple axios client like Studio and Wardrobe do (not createAuthenticatedApiClient)
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

interface TryOnHistoryItem {
  id: string
  image_url: string
  garment_urls?: string[]
  scene_image_url?: string
  prompt?: string
  created_at: string
}

const historyItems = ref<TryOnHistoryItem[]>([])
const isLoading = ref(false)
const error = ref('')
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])
const subscriptionInfo = ref<any>(null)

// Cache management for page refresh
const saveHistoryToCache = () => {
  try {
    sessionStorage.setItem('tryon_history_cache', JSON.stringify(historyItems.value))
  } catch (e) {
    console.warn('[TryOnHistory] Failed to save history to cache:', e)
  }
}

const restoreHistoryFromCache = () => {
  try {
    const cached = sessionStorage.getItem('tryon_history_cache')
    if (cached) {
      const items = JSON.parse(cached)
      if (Array.isArray(items) && items.length > 0) {
        historyItems.value = items
        console.log('[TryOnHistory] Restored history from cache:', items.length, 'items')
        return true
      }
    }
  } catch (e) {
    console.warn('[TryOnHistory] Failed to restore history from cache:', e)
  }
  return false
}
const isLoadingSubscription = ref(false) // Flag to prevent duplicate subscription API calls

// Subscription service client
const subscriptionClient = axios.create({
  baseURL: SUBSCRIPTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Load subscription info to determine retention period
const loadSubscriptionInfo = async () => {
  // Prevent duplicate concurrent calls
  if (isLoadingSubscription.value) {
    return
  }
  
  isLoadingSubscription.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      isLoadingSubscription.value = false
      return
    }

    const session = await supabase.auth.getSession()
    const response = await subscriptionClient.get('/subscription/status', {
      params: { user_id: user.id },
      headers: {
        Authorization: `Bearer ${session.data.session?.access_token || user.id}`,
      },
    })
    subscriptionInfo.value = response.data
  } catch (e: any) {
    console.warn('Failed to load subscription info:', e)
    // Default to Free plan if subscription info is unavailable
    subscriptionInfo.value = {
      planName: 'Free',
    }
  } finally {
    isLoadingSubscription.value = false
  }
}

const loadHistory = async () => {
  // Prevent duplicate concurrent calls
  if (isLoading.value) {
    return
  }
  
  isLoading.value = true
  error.value = ''
  try {
    // Manually get session and set header like Profile.vue does
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    
    if (!token) {
      throw new Error('No authentication token available')
    }
    
    const response = await apiClient.get<{ history: TryOnHistoryItem[] }>('/tryon-history', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    historyItems.value = response.data.history || []
    // Save to cache for next page refresh
    saveHistoryToCache()
  } catch (e: any) {
    console.error('Failed to load try-on history:', e)
    const errorDetail = e?.response?.data?.detail || e?.message || 'Failed to load try-on history'
    
    // If authentication failed, check session again
    if (e?.response?.status === 401 || errorDetail.includes('Not authenticated') || errorDetail.includes('authenticated')) {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        // Only redirect if we don't have cached data
        if (historyItems.value.length === 0) {
          router.push('/login')
          return
        }
      }
    }
    
    // Only show error if we don't have cached data (like Profile.vue does)
    if (historyItems.value.length === 0) {
      error.value = errorDetail
    } else {
      console.log('[TryOnHistory] API failed but using cached data, hiding error')
      error.value = '' // Clear error if we have cached data
    }
  } finally {
    isLoading.value = false
  }
}

const deleteHistoryItem = async (historyId: string) => {
if (!confirm('Delete this try-on history item?')) {
    return
  }
  
  try {
    await apiClient.delete(`/tryon-history/${historyId}`)
    await loadHistory()
  } catch (e: any) {
    console.error('Failed to delete history item:', e)
    alert(e?.response?.data?.detail || e?.message || 'Delete failed')
  }
}

const openImageViewer = (index: number) => {
  imageViewerImages.value = historyItems.value
    .map(item => item.image_url)
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
  restoreHistoryFromCache()
  
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
        console.warn(`[TryOnHistory] Attempt ${attempts + 1}/${maxAttempts} - Failed to get session:`, error)
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
          console.log(`[TryOnHistory] Session recovered after ${attempts + 1} attempt(s)`)
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
      console.warn('[TryOnHistory] No valid session after retries')
      // Don't redirect if we have cached data - user can still see their history
      if (historyItems.value.length === 0) {
        router.push('/login')
        return
      } else {
        console.log('[TryOnHistory] Using cached data, skipping API calls')
        return
      }
    }
    
    // Ensure token is available before making any API calls
    // Wait a bit more to ensure Supabase client is fully initialized
    await new Promise(resolve => setTimeout(resolve, 150))
    
  } catch (e) {
    console.error('[TryOnHistory] Failed to check session:', e)
    // Don't redirect if we have cached data
    if (historyItems.value.length === 0) {
      router.push('/login')
      return
    } else {
      console.log('[TryOnHistory] Using cached data after error, skipping API calls')
      return
    }
  }
  
  // Load data after session is confirmed
  // Use Promise.all to load both in parallel, but ensure session is ready first
  await Promise.all([
    loadSubscriptionInfo(),
    loadHistory()
  ])
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

// Get retention days based on subscription plan
const retentionDays = computed(() => {
  const planName = subscriptionInfo.value?.planName || 'Free'
  const planRetention: Record<string, number> = {
    'Free': 7,
    'Premium': 90,
    'Premium Plus': 365,
    // Support lowercase variants
    'free': 7,
    'premium': 90,
    'premium_plus': 365,
  }
  return planRetention[planName] || 7
})

const getDaysRemaining = (dateString: string) => {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() + (retentionDays.value * 24 * 60 * 60 * 1000) - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  } catch {
    return 0
  }
}

// Restore try-on history to Studio page
const restoreTryOnHistory = async (item: TryOnHistoryItem) => {
  try {
    // Save history data to sessionStorage for Studio page to restore
    const restoreData = {
      tryonHistoryId: item.id,
      image_url: item.image_url,
      garment_urls: item.garment_urls || [],
      scene_image_url: item.scene_image_url,
      prompt: item.prompt,
      created_at: item.created_at,
    }
    
    sessionStorage.setItem('tryon_history_restore', JSON.stringify(restoreData))
    
    // Navigate to Studio page with query parameter
    router.push({
      path: '/studio',
      query: { tryonHistoryId: item.id }
    })
  } catch (error: any) {
    console.error('Failed to restore try-on history:', error)
    alert('Failed to restore try-on history. Please try again.')
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
          <History class="w-6 h-6 text-blue-500" />
          Try-On History
        </h1>
      </div>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
      <div
        v-if="isLoading"
        class="py-12 flex flex-col items-center justify-center"
      >
        <div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-gray-500">Loading try-on history...</p>
      </div>

      <div v-else-if="error" class="py-8 text-center text-red-600 text-sm">
        {{ error }}
      </div>

      <div v-else-if="!historyItems.length" class="py-12 text-center">
        <History class="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p class="text-gray-500 text-sm mb-2">No try-on history yet</p>
        <p class="text-gray-400 text-xs">After you try on looks, results will be saved here automatically.</p>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="(item, index) in historyItems"
          :key="item.id"
          class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
        >
          <!-- Image -->
          <div
            @click="openImageViewer(index)"
            class="aspect-square bg-gray-100 cursor-pointer overflow-hidden relative"
          >
            <img
              :src="item.image_url"
              alt="Try-on result"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
            <!-- Days remaining badge -->
            <div class="absolute top-2 right-2 bg-blue-500/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              Expires in {{ getDaysRemaining(item.created_at) }} days
            </div>
          </div>
          
          <!-- Content -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex-1">
                <p class="text-xs text-gray-400 mb-1">
                  {{ formatDate(item.created_at) }}
                </p>
                <p v-if="item.garment_urls && item.garment_urls.length > 0" class="text-xs text-gray-500">
                  {{ item.garment_urls.length }} item(s)
                </p>
                <p v-if="item.scene_image_url" class="text-xs text-blue-500 mt-1">
                  include sence
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  @click.stop="restoreTryOnHistory(item)"
                  class="flex-shrink-0 w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center transition-colors group"
                  title="Restore to this fitting"
                >
                  <RotateCcw class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                </button>
                <button
                  @click.stop="deleteHistoryItem(item.id)"
                  class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                  title="Clear History"
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
            alt="Try-on result"
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

