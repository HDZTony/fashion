<script setup lang="ts">
defineOptions({ name: 'TryOnHistory' })
import { onMounted, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../lib/api-client'
import { History, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

// Ensure token is synced when component is activated (for keep-alive scenarios)
onActivated(async () => {
  try {
    await authStore.refreshSession()
  } catch (e) {
    console.warn('[TryOnHistory] Failed to refresh session on activated:', e)
  }
})

// Use unified API client from api-client.ts
// This ensures consistent authentication handling across all components
// The unified client already has interceptors with retry logic and token refresh
// This is critical for page refresh scenarios where the component may be cached by keep-alive

interface TryOnHistoryItem {
  id: string
  image_url: string
  garment_urls?: string[]
  scene_image_url?: string
  prompt?: string
  model_image_url?: string
  created_at: string
  expires_at: string
}

const historyItems = ref<TryOnHistoryItem[]>([])
const isLoading = ref(false)
const error = ref('')
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const totalPages = ref(0)

const loadHistory = async (page: number = 1) => {
  // Prevent duplicate concurrent calls
  if (isLoading.value) {
    return
  }
  
  isLoading.value = true
  error.value = ''
  try {
    // Interceptor automatically adds Authorization header from Supabase session or cookie
    const response = await apiClient.get<{ 
      history: TryOnHistoryItem[]
      total: number
      page: number
      limit: number
      total_pages: number
    }>('/tryon-history', {
      params: {
        page: page,
        limit: pageSize.value
      }
    })
    historyItems.value = response.data.history || []
    totalItems.value = response.data.total || 0
    currentPage.value = response.data.page || page
    totalPages.value = response.data.total_pages || 0

  } catch (e: any) {
    console.error('Failed to load try-on history:', e)
    const errorDetail = e?.response?.data?.detail || e?.message || 'Failed to load try-on history'
    
    // If authentication failed, redirect to login
    if (e?.response?.status === 401 || errorDetail.includes('Not authenticated') || errorDetail.includes('authenticated')) {
      router.push('/login')
      return
    }
    
    error.value = errorDetail
  } finally {
    isLoading.value = false
  }
}

const deleteHistoryItem = async (historyId: string) => {
  if (!confirm('Delete this try-on history item?')) {
    return
  }
  
  try {
    // Interceptor automatically adds Authorization header from Supabase session
    await apiClient.delete(`/tryon-history/${historyId}`)
    // Reload current page, or go to previous page if current page becomes empty
    await loadHistory(currentPage.value)
    // If current page is empty and not first page, go to previous page
    if (historyItems.value.length === 0 && currentPage.value > 1) {
      await loadHistory(currentPage.value - 1)
    }
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
  await loadHistory()
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

const getDaysRemaining = (expiresAt: string) => {
  try {
    const expiresDate = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiresDate.getTime() - now.getTime()
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
      model_image_url: item.model_image_url,
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
  <div class="min-h-screen bg-green-50/20 font-sans text-green-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2 text-green-800">
          <History class="w-6 h-6 text-green-600" />
          Try-On History
        </h1>
      </div>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
      <div
        v-if="isLoading"
        class="py-12 flex flex-col items-center justify-center"
      >
        <div class="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-green-700">Loading try-on history...</p>
      </div>

      <div v-else-if="error" class="py-8 text-center text-red-600 text-sm">
        {{ error }}
      </div>

      <div v-else-if="!historyItems.length" class="py-12 text-center">
        <History class="w-16 h-16 mx-auto mb-4 text-green-300" />
        <p class="text-green-700 text-sm mb-2">No try-on history yet</p>
        <p class="text-green-600 text-xs">After you try on looks, results will be saved here automatically.</p>
      </div>

      <div v-else>
        <!-- Statistics -->
        <div v-if="totalItems > 0" class="mb-4 text-sm text-green-700">
          Showing {{ historyItems.length }} of {{ totalItems }} item(s)
        </div>
        
        <!-- History Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(item, index) in historyItems"
            :key="item.id"
            class="bg-white border border-green-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
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
            <div class="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              Expires in {{ getDaysRemaining(item.expires_at) }} days
            </div>
          </div>
          
          <!-- Content -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex-1">
                <p class="text-xs text-green-400 mb-1">
                  {{ formatDate(item.created_at) }}
                </p>
                <p v-if="item.garment_urls && item.garment_urls.length > 0" class="text-xs text-green-500">
                  {{ item.garment_urls.length }} item(s)
                </p>
                <p v-if="item.scene_image_url" class="text-xs text-green-600 mt-1">
                  Includes scene
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  @click.stop="restoreTryOnHistory(item)"
                  class="flex-shrink-0 w-7 h-7 rounded-full hover:bg-green-50 flex items-center justify-center transition-colors group"
                  title="Restore to this fitting"
                >
                  <RotateCcw class="w-4 h-4 text-green-400 group-hover:text-green-600 transition-colors" />
                </button>
                <button
                  @click.stop="deleteHistoryItem(item.id)"
                  class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                  title="Clear History"
                >
                  <X class="w-4 h-4 text-green-400 group-hover:text-red-500 transition-colors" />
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-8 flex justify-center items-center gap-4">
          <button
            @click="loadHistory(currentPage - 1)"
            :disabled="currentPage === 1 || isLoading"
            class="px-4 py-2 border border-green-300 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 transition-colors"
          >
            Previous
          </button>
          <span class="px-4 py-2 text-green-700 text-sm">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <button
            @click="loadHistory(currentPage + 1)"
            :disabled="currentPage === totalPages || isLoading"
            class="px-4 py-2 border border-green-300 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 transition-colors"
          >
            Next
          </button>
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

