<script setup lang="ts">
defineOptions({ name: 'TryOnHistory' })
import { onMounted, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../lib/api-client'
import { getMediumImageUrl, getLargeImageUrl } from '../lib/imageOptimizer'
import { History, X, RotateCcw } from 'lucide-vue-next'
import ImageViewer from '@/components/ImageViewer.vue'

const { t } = useI18n()

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
  background_image_url?: string
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
  if (!confirm(t('history.deleteConfirm'))) {
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

function onImageViewerClose(open: boolean) {
  showImageViewer.value = open
  if (!open) {
    imageViewerImages.value = []
    currentImageIndex.value = 0
  }
}

// Keyboard navigation
onMounted(async () => {
  await loadHistory()
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
      background_image_url: item.background_image_url,
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
    alert(t('history.restoreFailed'))
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          <History class="w-6 h-6 text-pink-600" />
          {{ $t('history.title') }}
        </h1>
      </div>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
      <div
        v-if="isLoading"
        class="py-12 flex flex-col items-center justify-center"
      >
        <div class="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-pink-700 font-medium">{{ $t('history.loading') }}</p>
      </div>

      <div v-else-if="error" class="py-8 text-center text-red-600 text-sm">
        {{ error }}
      </div>

      <div v-else-if="!historyItems.length" class="py-12 text-center">
        <History class="w-16 h-16 mx-auto mb-4 text-pink-300" />
        <p class="text-gray-700 text-sm mb-2 font-medium">{{ $t('history.noHistory') }}</p>
        <p class="text-pink-600 text-xs">{{ $t('history.noHistoryDesc') }}</p>
      </div>

      <div v-else>
        <!-- Statistics -->
        <div v-if="totalItems > 0" class="mb-4 text-sm text-pink-700 font-medium">
          {{ $t('history.showing') }} {{ historyItems.length }} {{ $t('history.of') }} {{ totalItems }} {{ $t('history.items') }}
        </div>
        
        <!-- History Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(item, index) in historyItems"
            :key="item.id"
            class="bg-white border border-pink-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
          >
          <!-- Image -->
          <div
            @click="openImageViewer(index)"
            class="aspect-square bg-gray-100 cursor-pointer overflow-hidden relative"
          >
            <img
              :src="getMediumImageUrl(item.image_url)"
              loading="lazy"
              alt="Try-on result"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
            <!-- Days remaining badge -->
            <div class="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-purple-500/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm font-medium">
              {{ $t('history.expiresIn') }} {{ getDaysRemaining(item.expires_at) }} {{ $t('history.days') }}
            </div>
          </div>
          
          <!-- Content -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex-1">
                <p class="text-xs text-pink-400 mb-1">
                  {{ formatDate(item.created_at) }}
                </p>
                <p v-if="item.garment_urls && item.garment_urls.length > 0" class="text-xs text-pink-500">
                  {{ item.garment_urls.length }} {{ $t('history.items') }}
                </p>
                <p v-if="item.background_image_url" class="text-xs text-pink-600 mt-1">
                  {{ $t('history.includesBackground') }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button
                  @click.stop="restoreTryOnHistory(item)"
                  class="flex-shrink-0 w-7 h-7 rounded-full hover:bg-pink-50 flex items-center justify-center transition-colors group"
                  :title="$t('history.restoreToFitting')"
                >
                  <RotateCcw class="w-4 h-4 text-pink-400 group-hover:text-pink-600 transition-colors" />
                </button>
                <button
                  @click.stop="deleteHistoryItem(item.id)"
                  class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                  :title="$t('history.clearHistory')"
                >
                  <X class="w-4 h-4 text-pink-400 group-hover:text-red-500 transition-colors" />
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
            class="px-4 py-2 border border-pink-300 rounded-lg hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed text-pink-700 transition-colors font-medium"
          >
            {{ $t('history.previous') }}
          </button>
          <span class="px-4 py-2 text-pink-700 text-sm font-medium">
            {{ $t('history.page') }} {{ currentPage }} {{ $t('history.of') }} {{ totalPages }}
          </span>
          <button
            @click="loadHistory(currentPage + 1)"
            :disabled="currentPage === totalPages || isLoading"
            class="px-4 py-2 border border-pink-300 rounded-lg hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed text-pink-700 transition-colors font-medium"
          >
            {{ $t('history.next') }}
          </button>
        </div>
      </div>
    </main>

    <!-- Image Viewer (shared component) -->
    <ImageViewer
      :open="showImageViewer"
      :images="imageViewerImages"
      :initial-index="currentImageIndex"
      :resolve-url="getLargeImageUrl"
      alt="Try-on result"
      @update:open="onImageViewerClose"
      @update:current-index="(i) => (currentImageIndex = i)"
    />
  </div>
</template>

