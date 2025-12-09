<script setup lang="ts">
defineOptions({ name: 'Favorites' })
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { Heart, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const router = useRouter()
const API_URL = 'http://localhost:8000'

interface Favorite {
  id: string
  image_url: string
  title?: string
  created_at: string
}

const favorites = ref<Favorite[]>([])
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

const loadFavorites = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const response = await apiClient.get<{ favorites: Favorite[] }>('/favorites')
    favorites.value = response.data.favorites || []
  } catch (e: any) {
    console.error('Failed to load favorites:', e)
    error.value = e?.response?.data?.detail || e?.message || 'Failed to load favorites'
  } finally {
    isLoading.value = false
  }
}

const deleteFavorite = async (favoriteId: string) => {
  if (!confirm('确定要删除这个收藏吗？')) {
    return
  }
  
  try {
    await apiClient.delete(`/favorites/${favoriteId}`)
    await loadFavorites()
  } catch (e: any) {
    console.error('Failed to delete favorite:', e)
    alert(e?.response?.data?.detail || e?.message || '删除失败')
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

onMounted(() => {
  loadFavorites()
  window.addEventListener('keydown', handleKeyDown)
})

const goBack = () => {
  router.push('/')
}

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-6 font-sans text-gray-900">
    <header class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          @click="goBack"
          class="text-sm text-gray-500 hover:text-black underline"
        >
          ← Back to Home
        </button>
        <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Heart class="w-6 h-6 text-red-500 fill-current" />
          My Favorites
        </h1>
      </div>
    </header>

    <main class="max-w-6xl mx-auto">
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
        <p class="text-gray-500 text-sm mb-2">还没有收藏任何试穿结果</p>
        <p class="text-gray-400 text-xs">在首页试穿后，点击收藏按钮保存你喜欢的搭配</p>
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
              <h3 class="font-semibold text-sm text-gray-900 flex-1 truncate">
                {{ favorite.title || '试穿结果' }}
              </h3>
              <button
                @click.stop="deleteFavorite(favorite.id)"
                class="flex-shrink-0 w-6 h-6 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                title="删除收藏"
              >
                <X class="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
              </button>
            </div>
            <p class="text-xs text-gray-400">
              {{ formatDate(favorite.created_at) }}
            </p>
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

