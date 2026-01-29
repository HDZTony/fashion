<script setup lang="ts">
defineOptions({ name: 'MultiAngle' })
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { 
  Wand2, ChevronRight, RotateCw, 
  Trash2, History, Upload 
} from 'lucide-vue-next'
import ImageViewer from '@/components/ImageViewer.vue'
import { apiClient, uploadApiClient } from '../lib/api-client'
import { getMediumImageUrl, getLargeImageUrl } from '../lib/imageOptimizer'

const { t } = useI18n()
const route = useRoute()

// Source image from query parameter or upload
const sourceImageUrl = ref<string>('')
const isUploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

// Multi-angle state
const multiAngleImages = ref<Array<{
  id?: string
  url: string
  angle_type: string
  angle_params: any
  created_at?: string
}>>([])
const isGeneratingAngle = ref(false)
const showCustomAnglePanel = ref(false)
const angleParams = ref({
  horizontal: 0,
  vertical: 0,
  zoom: 5
})

// History state
const historyItems = ref<any[]>([])
const isLoadingHistory = ref(false)
const historyPage = ref(1)
const historyTotalPages = ref(0)

// Image viewer
const showImageViewer = ref(false)
const imageViewerImages = ref<string[]>([])
const currentImageIndex = ref(0)

// Preset angle definitions
const anglePresets = [
  { name: 'front', label: 'multiAngle.front', icon: '正' },
  { name: 'left', label: 'multiAngle.left', icon: '左' },
  { name: 'right', label: 'multiAngle.right', icon: '右' },
  { name: 'back', label: 'multiAngle.back', icon: '后' },
  { name: 'top', label: 'multiAngle.top', icon: '俯' },
]

// Load source image from query
onMounted(async () => {
  const sourceImage = route.query.sourceImage as string
  if (sourceImage) {
    sourceImageUrl.value = sourceImage
    // Load history for this source image
    await loadHistory()
  } else {
    // Load all history
    await loadHistory()
  }
  
})

// Watch for source image changes
watch(() => route.query.sourceImage, async (newVal) => {
  if (newVal) {
    sourceImageUrl.value = newVal as string
    multiAngleImages.value = []
    await loadHistory()
  }
})

// Load multi-angle history
const loadHistory = async () => {
  isLoadingHistory.value = true
  try {
    const params: any = {
      page: historyPage.value,
      limit: 20,
    }
    if (sourceImageUrl.value) {
      params.source_url = sourceImageUrl.value
    }
    
    const response = await apiClient.get<{
      history: any[]
      total: number
      page: number
      total_pages: number
    }>('/multiangle-history', { params })
    
    historyItems.value = response.data.history || []
    historyTotalPages.value = response.data.total_pages || 0
    
    // If viewing a specific source, populate multiAngleImages from history
    if (sourceImageUrl.value && historyItems.value.length > 0) {
      multiAngleImages.value = historyItems.value.map(item => ({
        id: item.id,
        url: item.result_url,
        angle_type: item.angle_type,
        angle_params: item.angle_params,
        created_at: item.created_at,
      }))
    }
  } catch (error: any) {
    console.error('[MultiAngle] Failed to load history:', error)
  } finally {
    isLoadingHistory.value = false
  }
}

// Generate multi-angle view
const generateMultiAngle = async (preset?: string) => {
  if (!sourceImageUrl.value) {
    alert(t('multiAngle.noSourceImage'))
    return
  }

  isGeneratingAngle.value = true

  try {
    const formData = new FormData()
    formData.append('image_url', sourceImageUrl.value)
    
    if (preset) {
      formData.append('preset', preset)
    } else {
      formData.append('horizontal_angle', String(angleParams.value.horizontal))
      formData.append('vertical_angle', String(angleParams.value.vertical))
    }
    formData.append('zoom', String(angleParams.value.zoom))

    const response = await uploadApiClient.post<{
      url: string
      angle_type: string
      angle_params: any
    }>('/generate-angles', formData)

    // Add to images array
    multiAngleImages.value.unshift({
      url: response.data.url,
      angle_type: response.data.angle_type,
      angle_params: response.data.angle_params,
    })
  } catch (error: any) {
    console.error('[MultiAngle] Generation failed:', error)
    
    let errorMessage = t('multiAngle.generationFailed')
    if (error.response?.status === 401) {
      errorMessage = '认证失败，请刷新页面或重新登录'
    } else if (error.response?.status === 403) {
      errorMessage = error.response?.data?.detail || t('multiAngle.insufficientCredits')
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    }
    
    alert(errorMessage)
  } finally {
    isGeneratingAngle.value = false
  }
}

// Delete history item
const deleteHistoryItem = async (id: string) => {
  if (!confirm(t('multiAngle.deleteConfirm'))) return
  
  try {
    await apiClient.delete(`/multiangle-history/${id}`)
    multiAngleImages.value = multiAngleImages.value.filter(img => img.id !== id)
    historyItems.value = historyItems.value.filter(item => item.id !== id)
  } catch (error: any) {
    console.error('[MultiAngle] Delete failed:', error)
    alert(error?.response?.data?.detail || 'Delete failed')
  }
}

// Clear current session images (not from history)
const clearCurrentImages = () => {
  multiAngleImages.value = multiAngleImages.value.filter(img => img.id)
}

// Image viewer functions
const openImageViewer = (index: number) => {
  const urls = multiAngleImages.value.map(img => img.url)
  if (urls.length === 0) return
  
  imageViewerImages.value = urls
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

// Image upload functions
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    await uploadImage(file)
  }
  // Reset input so same file can be selected again
  target.value = ''
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    await uploadImage(file)
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const uploadImage = async (file: File) => {
  isUploading.value = true
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    // Upload to R2 via backend (dedicated multiangle-source endpoint)
    const response = await uploadApiClient.post<{ url: string }>('/multiangle-source', formData)
    
    sourceImageUrl.value = response.data.url
    multiAngleImages.value = []
    
    console.log('[MultiAngle] Image uploaded:', response.data.url)
  } catch (error: any) {
    console.error('[MultiAngle] Upload failed:', error)
    alert(error?.response?.data?.detail || t('common.error'))
  } finally {
    isUploading.value = false
  }
}

</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
        <RotateCw class="w-6 h-6 text-pink-600" />
        {{ $t('multiAngle.title') }}
      </h1>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
      <!-- Source Image Section -->
      <section class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100 mb-6">
        <h2 class="text-lg font-semibold mb-4">{{ $t('multiAngle.sourceImage') }}</h2>
        
        <!-- Hidden file input for changing image -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          @change="handleFileSelect"
        />
        
        <div v-if="sourceImageUrl" class="flex flex-col md:flex-row gap-6">
          <!-- Source Image Preview -->
          <div class="w-full md:w-1/3">
            <div class="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
              <img 
                :src="getMediumImageUrl(sourceImageUrl)" 
                :alt="$t('multiAngle.sourceImage')"
                class="w-full h-full object-cover"
              />
              <!-- Change Image Overlay -->
              <div 
                @click="triggerFileInput"
                class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
              >
                <div class="text-white text-center">
                  <Upload class="w-6 h-6 mx-auto mb-1" />
                  <span class="text-sm">{{ $t('multiAngle.changeImage') }}</span>
                </div>
              </div>
            </div>
            <!-- Loading indicator for upload -->
            <div v-if="isUploading" class="mt-2 flex items-center justify-center gap-2 text-sm text-pink-600">
              <div class="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              <span>{{ $t('common.loading') }}</span>
            </div>
          </div>
          
          <!-- Controls -->
          <div class="flex-1">
            <!-- Preset Buttons -->
            <div class="mb-6">
              <p class="text-sm text-gray-600 mb-3">{{ $t('multiAngle.presets') }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in anglePresets"
                  :key="preset.name"
                  @click="generateMultiAngle(preset.name)"
                  :disabled="isGeneratingAngle"
                  class="px-4 py-2.5 text-sm rounded-lg border border-pink-200 bg-white hover:bg-pink-50 hover:border-pink-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span class="text-pink-600 font-medium text-lg">{{ preset.icon }}</span>
                  <span>{{ $t(preset.label) }}</span>
                </button>
              </div>
            </div>
            
            <!-- Custom Angle Toggle -->
            <div class="mb-4">
              <button
                @click="showCustomAnglePanel = !showCustomAnglePanel"
                class="text-sm text-pink-600 hover:text-pink-800 transition-colors flex items-center gap-1"
              >
                <span>{{ $t('multiAngle.custom') }}</span>
                <ChevronRight :class="['w-4 h-4 transition-transform', showCustomAnglePanel && 'rotate-90']" />
              </button>
            </div>
            
            <!-- Custom Angle Controls -->
            <div v-if="showCustomAnglePanel" class="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div class="space-y-5">
                <!-- Horizontal Angle -->
                <div>
                  <div class="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{{ $t('multiAngle.horizontal') }}</span>
                    <span class="font-medium text-pink-600">{{ angleParams.horizontal }}°</span>
                  </div>
                  <input
                    type="range"
                    v-model.number="angleParams.horizontal"
                    min="0"
                    max="360"
                    step="15"
                    class="w-full h-2 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                </div>
                
                <!-- Vertical Angle -->
                <div>
                  <div class="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{{ $t('multiAngle.vertical') }}</span>
                    <span class="font-medium text-pink-600">{{ angleParams.vertical }}°</span>
                  </div>
                  <input
                    type="range"
                    v-model.number="angleParams.vertical"
                    min="-30"
                    max="90"
                    step="10"
                    class="w-full h-2 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                </div>
                
                <!-- Zoom -->
                <div>
                  <div class="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{{ $t('multiAngle.zoom') }}</span>
                    <span class="font-medium text-pink-600">{{ angleParams.zoom }}</span>
                  </div>
                  <input
                    type="range"
                    v-model.number="angleParams.zoom"
                    min="0"
                    max="10"
                    step="1"
                    class="w-full h-2 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                </div>
                
                <!-- Generate Button -->
                <button
                  @click="generateMultiAngle()"
                  :disabled="isGeneratingAngle"
                  class="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium hover:from-pink-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <div v-if="isGeneratingAngle" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <Wand2 v-else class="w-4 h-4" />
                  <span>{{ isGeneratingAngle ? $t('multiAngle.generating') : $t('multiAngle.generate') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- No Source Image - Upload UI -->
        <div v-else class="py-8">
          <!-- Hidden file input -->
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileSelect"
          />
          
          <!-- Upload Area -->
          <div
            @click="triggerFileInput"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            :class="[
              'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
              isDragging 
                ? 'border-pink-500 bg-pink-50' 
                : 'border-pink-200 hover:border-pink-400 hover:bg-pink-50/50'
            ]"
          >
            <div v-if="isUploading" class="flex flex-col items-center">
              <div class="w-10 h-10 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p class="text-gray-600">{{ $t('common.loading') }}</p>
            </div>
            <div v-else class="flex flex-col items-center">
              <Upload class="w-12 h-12 text-pink-400 mb-4" />
              <p class="text-gray-700 font-medium mb-2">{{ $t('multiAngle.dropImageHere') }}</p>
              <p class="text-sm text-gray-500">{{ $t('multiAngle.supportedFormats') }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Loading State -->
      <div v-if="isGeneratingAngle && multiAngleImages.length === 0" class="py-12 flex flex-col items-center justify-center">
        <div class="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-gray-700 animate-pulse">{{ $t('multiAngle.generating') }}</p>
      </div>

      <!-- Generated Images Grid -->
      <section v-if="multiAngleImages.length > 0" class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <History class="w-5 h-5 text-pink-600" />
            {{ $t('multiAngle.results') }}
          </h2>
          <button
            v-if="multiAngleImages.some(img => !img.id)"
            @click="clearCurrentImages"
            class="text-xs text-pink-600 hover:text-pink-800 transition-colors"
          >
            {{ $t('multiAngle.clearAll') }}
          </button>
        </div>
        
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div
            v-for="(img, index) in multiAngleImages"
            :key="img.id || index"
            class="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:border-pink-300 transition-colors group"
            @click="openImageViewer(index)"
          >
            <img
              :src="getMediumImageUrl(img.url)"
              loading="lazy"
              :alt="`${img.angle_type} view`"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <span class="text-sm text-white font-medium">{{ img.angle_type }}</span>
            </div>
            <!-- Delete button -->
            <button
              v-if="img.id"
              @click.stop="deleteHistoryItem(img.id)"
              class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <!-- Empty History State -->
      <section v-else-if="!isLoadingHistory && !sourceImageUrl" class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100">
        <div class="py-12 text-center">
          <RotateCw class="w-16 h-16 mx-auto mb-4 text-pink-300" />
          <p class="text-gray-700 mb-2">{{ $t('multiAngle.noHistory') }}</p>
          <p class="text-sm text-pink-600">{{ $t('multiAngle.noHistoryDesc') }}</p>
        </div>
      </section>
    </main>

    <!-- Image Viewer (shared component) -->
    <ImageViewer
      :open="showImageViewer"
      :images="imageViewerImages"
      :initial-index="currentImageIndex"
      :resolve-url="getLargeImageUrl"
      alt="Multi-angle view"
      @update:open="onImageViewerClose"
      @update:current-index="(i) => (currentImageIndex = i)"
    />
  </div>
</template>
