<script setup lang="ts">
defineOptions({ name: 'MultiAngleHistory' })
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { 
  RotateCw, X, ChevronLeft, ChevronRight, Trash2, 
  Image as ImageIcon, Calendar
} from 'lucide-vue-next'
import ImageViewer from '@/components/ImageViewer.vue'
import { apiClient } from '../lib/api-client'
import { getMediumImageUrl, getLargeImageUrl } from '../lib/imageOptimizer'

const { t } = useI18n()
const router = useRouter()

// History state
const historyItems = ref<Array<{
  id: string
  source_tryon_url: string
  result_url: string
  angle_type: string
  angle_params: any
  created_at: string
}>>([])
const isLoading = ref(false)
const currentPage = ref(1)
const totalPages = ref(0)
const totalItems = ref(0)
const pageSize = 20

// Image viewer
const showImageViewer = ref(false)
const imageViewerImages = ref<string[]>([])
const currentImageIndex = ref(0)

// Load history
const loadHistory = async (page: number = 1) => {
  isLoading.value = true
  try {
    const response = await apiClient.get<{
      history: any[]
      total: number
      page: number
      total_pages: number
    }>('/multiangle-history', {
      params: {
        page,
        limit: pageSize,
      }
    })
    
    historyItems.value = response.data.history || []
    totalPages.value = response.data.total_pages || 0
    totalItems.value = response.data.total || 0
    currentPage.value = page
  } catch (error: any) {
    console.error('[MultiAngleHistory] Failed to load:', error)
  } finally {
    isLoading.value = false
  }
}

// Delete history item
const deleteItem = async (id: string) => {
  if (!confirm(t('multiAngleHistory.deleteConfirm'))) return
  
  try {
    await apiClient.delete(`/multiangle-history/${id}`)
    historyItems.value = historyItems.value.filter(item => item.id !== id)
    totalItems.value--
  } catch (error: any) {
    console.error('[MultiAngleHistory] Delete failed:', error)
    alert(error?.response?.data?.detail || 'Delete failed')
  }
}

// Navigate to multi-angle page with source image
const viewInMultiAngle = (sourceUrl: string) => {
  router.push({
    path: '/multi-angle',
    query: { sourceImage: sourceUrl }
  })
}

// Image viewer functions
const openImageViewer = (resultUrl: string) => {
  imageViewerImages.value = [resultUrl]
  currentImageIndex.value = 0
  showImageViewer.value = true
}

function onImageViewerClose(open: boolean) {
  showImageViewer.value = open
  if (!open) {
    imageViewerImages.value = []
    currentImageIndex.value = 0
  }
}

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Get angle label
const getAngleLabel = (angleType: string) => {
  const labels: Record<string, string> = {
    front: t('multiAngle.front'),
    left: t('multiAngle.left'),
    right: t('multiAngle.right'),
    back: t('multiAngle.back'),
    top: t('multiAngle.top'),
    custom: t('multiAngle.custom'),
  }
  return labels[angleType] || angleType
}

// Pagination
const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    loadHistory(page)
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
        <RotateCw class="w-6 h-6 text-pink-600" />
        {{ $t('multiAngleHistory.title') }}
      </h1>
      <p class="mt-2 text-gray-600">{{ $t('multiAngleHistory.description') }}</p>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl pb-12">
      <!-- Loading State -->
      <div v-if="isLoading" class="py-12 flex flex-col items-center justify-center">
        <div class="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-gray-600">{{ $t('common.loading') }}</p>
      </div>

      <!-- Empty State -->
      <section v-else-if="historyItems.length === 0" class="bg-white p-8 rounded-2xl shadow-sm border border-pink-100">
        <div class="py-12 text-center">
          <ImageIcon class="w-16 h-16 mx-auto mb-4 text-pink-300" />
          <p class="text-gray-700 mb-2">{{ $t('multiAngleHistory.empty') }}</p>
          <p class="text-sm text-gray-500 mb-6">{{ $t('multiAngleHistory.emptyDesc') }}</p>
          <router-link 
            to="/multi-angle"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium hover:from-pink-600 hover:to-purple-600 transition-all"
          >
            <RotateCw class="w-4 h-4" />
            {{ $t('multiAngleHistory.goToMultiAngle') }}
          </router-link>
        </div>
      </section>

      <!-- History Grid -->
      <section v-else class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold">
            {{ $t('multiAngleHistory.totalItems', { count: totalItems }) }}
          </h2>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="item in historyItems"
            :key="item.id"
            class="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden hover:border-pink-300 transition-colors"
          >
            <!-- Images Row -->
            <div class="flex">
              <!-- Source Image -->
              <div class="w-1/2 aspect-square relative group">
                <img
                  :src="getMediumImageUrl(item.source_tryon_url)"
                  loading="lazy"
                  alt="Source"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    @click="viewInMultiAngle(item.source_tryon_url)"
                    class="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-medium text-gray-800 hover:bg-white transition-colors"
                  >
                    {{ $t('multiAngleHistory.generateMore') }}
                  </button>
                </div>
                <span class="absolute top-2 left-2 px-2 py-0.5 bg-black/50 rounded text-xs text-white">
                  {{ $t('multiAngleHistory.source') }}
                </span>
              </div>
              
              <!-- Result Image -->
              <div class="w-1/2 aspect-square relative group cursor-pointer" @click="openImageViewer(item.result_url)">
                <img
                  :src="getMediumImageUrl(item.result_url)"
                  loading="lazy"
                  alt="Result"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span class="text-white text-sm font-medium">{{ $t('multiAngleHistory.viewFull') }}</span>
                </div>
                <span class="absolute top-2 right-2 px-2 py-0.5 bg-pink-500 rounded text-xs text-white">
                  {{ getAngleLabel(item.angle_type) }}
                </span>
              </div>
            </div>
            
            <!-- Info & Actions -->
            <div class="p-3 flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar class="w-3.5 h-3.5" />
                <span>{{ formatDate(item.created_at) }}</span>
              </div>
              <button
                @click="deleteItem(item.id)"
                class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                :title="$t('common.delete')"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6 flex items-center justify-center gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          
          <span class="px-4 py-2 text-sm text-gray-600">
            {{ currentPage }} / {{ totalPages }}
          </span>
          
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </section>
    </main>

    <!-- Image Viewer (shared component) -->
    <ImageViewer
      :open="showImageViewer"
      :images="imageViewerImages"
      :initial-index="currentImageIndex"
      :resolve-url="getLargeImageUrl"
      alt="Multi-angle result"
      @update:open="onImageViewerClose"
      @update:current-index="(i) => (currentImageIndex = i)"
    />
  </div>
</template>
