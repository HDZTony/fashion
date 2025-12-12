<script setup lang="ts">
defineOptions({ name: 'TryOnHistory' })
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { History, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const API_URL = 'http://localhost:8000'

interface TryOnHistoryItem {
  id: string
  image_url: string
  garment_urls?: string[]
  scene_image_url?: string
  created_at: string
}

const historyItems = ref<TryOnHistoryItem[]>([])
const isLoading = ref(false)
const error = ref('')
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(async (config) => {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (e) {
    console.warn('Failed to get Supabase session for request:', e)
  }
  return config
})

const loadHistory = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const response = await apiClient.get<{ history: TryOnHistoryItem[] }>('/tryon-history')
    historyItems.value = response.data.history || []
  } catch (e: any) {
    console.error('Failed to load try-on history:', e)
    error.value = e?.response?.data?.detail || e?.message || 'Failed to load try-on history'
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

onMounted(() => {
  loadHistory()
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

const getDaysRemaining = (dateString: string) => {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() + (7 * 24 * 60 * 60 * 1000) - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  } catch {
    return 0
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
      <div class="text-xs text-gray-500">
        保留 7 天历史
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
                  包含场景
                </p>
              </div>
              <button
                @click.stop="deleteHistoryItem(item.id)"
                class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                title="删除历史记录"
              >
                <X class="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
              </button>
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

