<script setup lang="ts">
defineOptions({ name: 'Wardrobe' })
import { ref, onMounted, onUnmounted, onActivated, watch, computed } from 'vue'
import { Upload, Shirt, X, ChevronLeft, ChevronRight, Trash2, RefreshCw, CheckCircle } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import type { Item, PendingItem } from '../types'
import { apiClient, uploadApiClient, longUploadApiClient } from '../lib/api-client'
import { API_URL } from '../config/api'

const route = useRoute()

const uploadedItems = ref<Item[]>([])
const hasLoadedItems = ref(false)
const typeFilters = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Shoes', 'Accessories', 'Sportswear', 'Traditional']
const selectedFilter = ref('All')
const isUploading = ref(false)
const uploadProgress = ref<{ current: number; total: number; currentFile: string } | null>(null)
const pendingItems = ref<PendingItem[]>([])
const showConfirmDialog = ref(false)
const isConfirming = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedFileSignatures = new Set<string>()
const pendingUploadSignatures = new Set<string>()
const imageUrlInput = ref('')
const isUploadingUrl = ref(false)

// Persistent selection for outfit generation (synced with Studio.vue)
const selectedForOutfitIds = ref<Set<string>>(new Set())

// Load selection from localStorage on mount
const loadOutfitSelection = () => {
  try {
    const saved = localStorage.getItem('fashion_rec_selected_items')
    if (saved) {
      const ids = JSON.parse(saved)
      if (Array.isArray(ids)) {
        selectedForOutfitIds.value = new Set(ids)
      }
    }
  } catch (e) {
    console.error('Failed to load selection from localStorage:', e)
  }
}

// Toggle selection and save to localStorage
const toggleOutfitSelection = (itemId: string, event?: Event) => {
  if (event) {
    event.stopPropagation()
  }
  
  if (selectedForOutfitIds.value.has(itemId)) {
    selectedForOutfitIds.value.delete(itemId)
  } else {
    selectedForOutfitIds.value.add(itemId)
  }
  
  // Save to localStorage
  try {
    localStorage.setItem(
      'fashion_rec_selected_items', 
      JSON.stringify(Array.from(selectedForOutfitIds.value))
    )
  } catch (e) {
    console.error('Failed to save selection to localStorage:', e)
  }
}

const isOutfitSelected = (itemId: string) => selectedForOutfitIds.value.has(itemId)

const getFileSignature = (file: File) => `${file.name}-${file.size}-${file.lastModified}`

const categoryKeywords: Record<string, string[]> = {
  Tops: ['t-shirt', 'tee', 'shirt', 'blouse', 'hoodie', 'sweater', 'cardigan', 'tank', 'camisole', 'polo', 'top'],
  Bottoms: ['jeans', 'pants', 'trousers', 'shorts', 'skirt', 'leggings', 'chinos', 'culottes', 'palazzo', 'bottom'],
  Outerwear: ['jacket', 'coat', 'blazer', 'windbreaker', 'bomber', 'parka', 'poncho', 'outerwear'],
  Dresses: ['dress', 'gown', 'sundress', 'slip dress', 'cheongsam', 'qipao'],
  Shoes: ['shoe', 'sneaker', 'boot', 'heel', 'loafer', 'sandal', 'flat', 'mule', 'slipper', 'cleat'],
  Accessories: ['belt', 'hat', 'scarf', 'watch', 'sunglasses', 'bag', 'purse', 'jewelry', 'bracelet', 'necklace', 'glove', 'wallet'],
  Sportswear: ['jersey', 'compression', 'yoga', 'active', 'tracksuit', 'swim', 'athletic', 'sports'],
  Traditional: ['hanfu', 'kimono', 'sari', 'dirndl', 'kebaya', 'tuxedo', 'suit', 'uniform'],
}

const triggerFileInput = () => {
  if (fileInputRef.value) {
    // Ensure multiple attribute is set
    fileInputRef.value.multiple = true
    fileInputRef.value.click()
  }
}

const isLoadingItems = ref(false)

// Check if backend is ready before loading items
const checkBackendHealth = async (maxRetries = 5, delay = 1000): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await apiClient.get<{ status: string; model_loaded: boolean; database_ready: boolean }>('/health', {
        timeout: 5000,
      })
      if (response.data.status === 'ready') {
        return true
      }
      // Still initializing, wait and retry
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    } catch (error) {
      // If health check fails, wait and retry
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  return false
}

const loadUserItems = async () => {
  isLoadingItems.value = true
  try {
    // First check if backend is ready
    const isReady = await checkBackendHealth()
    if (!isReady) {
      console.warn('Backend is still initializing, but attempting to load items anyway...')
    }
    
    const response = await apiClient.get<{ items: any[] }>('/items', {
      timeout: 30000, // 30 seconds timeout
    })
    if (!response.data || !response.data.items) {
      console.warn('Invalid response format:', response.data)
      uploadedItems.value = []
      return
    }
    uploadedItems.value = response.data.items.map((item) => ({
      id: item.id,
      url: item.path || item.url || '',
      features: {
        path: item.path || item.url || '',
        type: item.type || 'Unknown',
        color: item.color || 'Unknown',
        style: item.style || 'Unknown',
        pattern: item.pattern,
        occasion: item.occasion,
        material: item.material,
      },
    }))
    hasLoadedItems.value = true
    // Save to sessionStorage for persistence across component recreations
    saveItemsToCache()
    // Mark that we've successfully loaded (clear the attempt flag)
    sessionStorage.removeItem('wardrobe_load_attempted')
    console.log('Loaded user items:', uploadedItems.value.length)
  } catch (error: any) {
    console.error('Failed to load user items:', error)
    let errorMessage = 'Unknown error'
    
    if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error') || error?.message?.includes('Connection')) {
      errorMessage = `Cannot reach backend service. Please ensure ${API_URL} is running.`
    } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      errorMessage = 'Request timed out; backend may still be initializing. Wait a moment and refresh.'
    } else if (error?.response?.status === 401) {
      errorMessage = 'Authentication failed. Please sign in again.'
    } else if (error?.response?.status === 503) {
      errorMessage = 'Backend is initializing; please wait a moment and refresh.'
    } else if (error?.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    alert(`Failed to load wardrobe data: ${errorMessage}\n\nCheck that the backend is running, or refresh and retry.`)
  } finally {
    isLoadingItems.value = false
  }
}


const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (!files || files.length === 0) {
    console.warn('No files selected')
    return
  }

  const fileArray = Array.from(files)
  const maxSize = 10 * 1024 * 1024 // 10MB
  const invalidFiles: string[] = []
  const duplicateFiles: string[] = []
  const fileSignatures = new Map<File, string>()

  for (const file of fileArray) {
    const signature = getFileSignature(file)
    fileSignatures.set(file, signature)

    const lowerName = file.name.toLowerCase()
    const isAvifByExt = lowerName.endsWith('.avif')
    const isImageByType = file.type.startsWith('image/')

    if (!isImageByType && !isAvifByExt) {
      invalidFiles.push(`${file.name} (not an image)`)
    } else if (file.size > maxSize) {
      invalidFiles.push(`${file.name} (exceeds 10MB)`)
    } else if (uploadedFileSignatures.has(signature) || pendingUploadSignatures.has(signature)) {
      duplicateFiles.push(`${file.name} (already uploaded)`)
    }
  }

  if (invalidFiles.length > 0 || duplicateFiles.length > 0) {
    const messages = []
    if (invalidFiles.length > 0) {
      messages.push(`Invalid files:\n${invalidFiles.join('\n')}`)
    }
    if (duplicateFiles.length > 0) {
      messages.push(`Duplicate files:\n${duplicateFiles.join('\n')}`)
    }
    alert(messages.join('\n\n'))
    target.value = ''
    return
  }

  isUploading.value = true
  uploadProgress.value = {
    current: 0,
    total: fileArray.length,
    currentFile: fileArray[0]?.name || '',
  }

  const successfulUploads: Item[] = []
  const failedUploads: { filename: string; error: string }[] = []
  const allPendingItems: PendingItem[] = [] // Collect all pending items from all files

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i]

    uploadProgress.value = {
      current: i + 1,
      total: fileArray.length,
      currentFile: file.name,
    }

    const formData = new FormData()
    const signature = fileSignatures.get(file) ?? getFileSignature(file)
    pendingUploadSignatures.add(signature)
    formData.append('file', file)

    try {
      const response = await uploadApiClient.post<{ auto_added: boolean; items: Item[] }>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.auto_added) {
        successfulUploads.push(...response.data.items)
      } else {
        // Collect pending items instead of immediately showing dialog
        const pending: PendingItem[] = response.data.items.map((item) => ({
          ...item,
          selected: true,
        }))
        allPendingItems.push(...pending)
      }
      uploadedFileSignatures.add(signature)
    } catch (error: any) {
      console.error(`Upload failed for ${file.name}:`, error)
      const errorMessage = error?.response?.data?.detail || error?.message || 'Upload failed'
      failedUploads.push({ filename: file.name, error: errorMessage })
      continue
    } finally {
      pendingUploadSignatures.delete(signature)
    }
  }

  // Show confirmation dialog only after all files are processed
  if (allPendingItems.length > 0) {
    pendingItems.value.push(...allPendingItems)
    showConfirmDialog.value = true
  }

  // Refresh data if there were successful uploads
  if (successfulUploads.length > 0) {
    await loadUserItems()
  }

  // Show success/failure messages
  if (successfulUploads.length > 0 && failedUploads.length === 0 && allPendingItems.length === 0) {
    console.log(`Successfully uploaded ${successfulUploads.length} file(s)`)
  } else if (successfulUploads.length > 0 && failedUploads.length > 0) {
    alert(
      `Uploaded ${successfulUploads.length} file(s) successfully.\n\nFailed:\n${failedUploads
        .map((f) => `${f.filename}: ${f.error}`)
        .join('\n')}`,
    )
  } else if (failedUploads.length > 0 && successfulUploads.length === 0 && allPendingItems.length === 0) {
    alert(
      `All uploads failed:\n${failedUploads
        .map((f) => `${f.filename}: ${f.error}`)
        .join('\n')}`,
    )
  }

  target.value = ''
  isUploading.value = false
  uploadProgress.value = null
}

const handleUrlUpload = async () => {
  const url = imageUrlInput.value.trim()
  
  if (!url) {
    alert('Please enter an image URL')
    return
  }
  
  // Validate URL format
  try {
    new URL(url)
  } catch {
    alert('Invalid URL. Please enter a valid http:// or https:// link.')
    return
  }
  
  // Check if URL is already uploaded
  if (uploadedFileSignatures.has(url) || pendingUploadSignatures.has(url)) {
    alert('This URL was already uploaded.')
    return
  }
  
  isUploadingUrl.value = true
  pendingUploadSignatures.add(url)
  
  try {
    const formData = new FormData()
    formData.append('image_url', url)
    
    // Use long timeout client for URL uploads (download + upload to R2 + analysis)
    // Large images or slow networks may need up to 10 minutes
    const response = await longUploadApiClient.post<{ auto_added: boolean; items: Item[] }>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    if (response.data.auto_added) {
      await loadUserItems()
      alert(`Added ${response.data.items.length} item(s) successfully.`)
    } else {
      const pending: PendingItem[] = response.data.items.map((item) => ({
        ...item,
        selected: true,
      }))
      pendingItems.value.push(...pending)
      showConfirmDialog.value = true
    }
    uploadedFileSignatures.add(url)
    imageUrlInput.value = ''
  } catch (error: any) {
    console.error(`URL upload failed:`, error)
    console.error('Error response:', error?.response?.data)
    let errorMessage = 'Upload failed'
    
    // Handle connection refused error specifically
    if (error?.code === 'ERR_CONNECTION_REFUSED' || error?.message?.includes('Connection refused') || error?.message?.includes('ERR_CONNECTION_REFUSED')) {
      errorMessage = `Cannot reach backend (${API_URL}).\n\nIf the backend is down:\n1) Ensure it is running\n2) Check backend logs for errors\n3) Restart the backend`
    } else if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error') || error?.message?.includes('ERR_CONNECTION_RESET')) {
      errorMessage = 'Network error or connection reset.\n\nPossible causes:\n1) Image too large, processing takes too long\n2) Unstable network\n3) Backend timed out\n\nTry:\n- Use a smaller image\n- Check your connection\n- Retry later\n- For large images, upload the file instead of URL'
    } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      errorMessage = 'Request timed out (waited 10 minutes).\n\nPossible causes:\n1) Image too large; download or processing is slow\n2) Slow network\n3) Server responding slowly\n\nTry:\n- Use a smaller image URL\n- Upload the image file directly (often faster)\n- Check your network\n- Retry later'
    } else if (error?.response?.status === 500) {
      // 500 Internal Server Error - show backend error details
      const backendError = error?.response?.data?.detail || error?.response?.data?.message || 'Server internal error'
      errorMessage = `Server error (500): ${backendError}\n\nCheck backend logs for details, or try again later.`
    } else if (error?.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error?.message) {
      errorMessage = error.message
    }
    
    alert(`Upload failed: ${errorMessage}`)
  } finally {
    isUploadingUrl.value = false
    pendingUploadSignatures.delete(url)
  }
}

const confirmAddItems = async () => {
  const selectedItems = pendingItems.value.filter((item) => item.selected)

  if (selectedItems.length === 0) {
    alert('Please select at least one item to add')
    return
  }

  try {
    isConfirming.value = true
    // Use uploadApiClient for batch operations as they may take longer
    await uploadApiClient.post<{ items: Item[] }>('/items/batch', selectedItems)
    
    // Refresh data to ensure consistency
    await loadUserItems()
    console.log(`Added ${selectedItems.length} item(s) to wardrobe`)

    pendingItems.value = []
    showConfirmDialog.value = false
  } catch (error: any) {
    console.error('Failed to add items:', error)
    const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to add items'
    alert(`Failed to add items: ${errorMessage}`)
  } finally {
    isConfirming.value = false
  }
}

const cancelAddItems = () => {
  pendingItems.value = []
  showConfirmDialog.value = false
}

const formatFeatureValue = (value: string | string[] | undefined): string => {
  if (!value) return 'Unknown'
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value
}

const getTypeCandidates = (typeValue: string | string[] | undefined) => {
  if (!typeValue) return []
  if (Array.isArray(typeValue)) {
    return typeValue.map((t) => t.toLowerCase())
  }
  return [typeValue.toLowerCase()]
}

const matchesCategory = (typeValue: string | string[] | undefined, category: string) => {
  if (category === 'All') return true
  const candidates = getTypeCandidates(typeValue)
  if (candidates.length === 0) return false
  const keywords = categoryKeywords[category] || []
  return candidates.some((candidate) => keywords.some((keyword) => candidate.includes(keyword)))
}

const filteredItems = computed(() => {
  return uploadedItems.value.filter((item) => matchesCategory(item.features.type, selectedFilter.value))
})

// Batch delete functionality
const isSelectionMode = ref(false)
const selectedItemIds = ref<Set<string>>(new Set())
const isDeleting = ref(false)

const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  if (!isSelectionMode.value) {
    selectedItemIds.value.clear()
  }
}

const toggleItemSelection = (itemId: string, event?: Event) => {
  if (event) {
    event.stopPropagation()
  }
  if (selectedItemIds.value.has(itemId)) {
    selectedItemIds.value.delete(itemId)
  } else {
    selectedItemIds.value.add(itemId)
  }
}

const toggleSelectAll = () => {
  if (selectedItemIds.value.size === filteredItems.value.length) {
    selectedItemIds.value.clear()
  } else {
    filteredItems.value.forEach(item => {
      selectedItemIds.value.add(String(item.id))
    })
  }
}

const selectedCount = computed(() => selectedItemIds.value.size)
const isAllSelected = computed(() => {
  return filteredItems.value.length > 0 && selectedItemIds.value.size === filteredItems.value.length
})

const deleteSelectedItems = async () => {
  if (selectedItemIds.value.size === 0) {
    alert('Select items to delete first.')
    return
  }

  if (!confirm(`Delete ${selectedItemIds.value.size} selected item(s)? This cannot be undone.`)) {
    return
  }

  isDeleting.value = true
  try {
    const itemIdsArray = Array.from(selectedItemIds.value)
    const response = await apiClient.post<{ deleted_count: number; message: string }>('/items/delete', {
      item_ids: itemIdsArray
    })

    // Clear selection and exit selection mode
    selectedItemIds.value.clear()
    isSelectionMode.value = false

    // Reload items from server to ensure data consistency
    await loadUserItems()

    alert(`Deleted ${response.data.deleted_count} item(s)`)
  } catch (error: any) {
    console.error('Failed to delete items:', error)
    const errorMessage = error?.response?.data?.detail || error?.message || 'Delete failed'
    alert(`Delete failed: ${errorMessage}`)
    
    // Reload items even on error to ensure UI is in sync
    await loadUserItems()
  } finally {
    isDeleting.value = false
  }
}

// Image viewer for wardrobe items
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])

// Image viewer functions
const openImageViewer = (index: number, event?: Event) => {
  // Don't open viewer if in selection mode
  if (isSelectionMode.value) {
    return
  }
  
  if (event) {
    event.stopPropagation()
  }
  
  const validImages = filteredItems.value
    .map((item) => item.url || item.features.path)
    .filter((url): url is string => !!url)
  
  if (validImages.length === 0) return
  
  imageViewerImages.value = validImages
  // Find the actual index in the filtered array
  let actualIndex = 0
  let count = 0
  for (let i = 0; i < filteredItems.value.length; i++) {
    const item = filteredItems.value[i]
    if (item.url || item.features.path) {
      if (i === index) {
        actualIndex = count
        break
      }
      count++
    }
  }
  currentImageIndex.value = actualIndex
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

// Keyboard navigation for image viewer
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
  // Try to restore items from sessionStorage on mount
  if (uploadedItems.value.length === 0) {
    restoreItemsFromCache()
  }
  loadOutfitSelection()
  window.addEventListener('keydown', handleKeyDown)
})

// Save items to sessionStorage
const saveItemsToCache = () => {
  try {
    sessionStorage.setItem('wardrobe_items_cache', JSON.stringify(uploadedItems.value))
  } catch (e) {
    console.warn('Failed to save items to sessionStorage:', e)
  }
}

// Restore items from sessionStorage if available
const restoreItemsFromCache = () => {
  try {
    const cached = sessionStorage.getItem('wardrobe_items_cache')
    if (cached) {
      const items = JSON.parse(cached)
      if (Array.isArray(items) && items.length > 0) {
        uploadedItems.value = items
        hasLoadedItems.value = true
        console.log('[Wardrobe] Restored items from sessionStorage:', items.length)
        return true
      }
    }
  } catch (e) {
    console.warn('Failed to restore items from sessionStorage:', e)
  }
  return false
}

onActivated(() => {
  // Reload selection from localStorage when component is activated
  // This ensures the selection state is synced when user returns from Studio page
  loadOutfitSelection()
  
  // Restore items from cache if memory is empty (keep-alive may have failed)
  if (uploadedItems.value.length === 0) {
    const restored = restoreItemsFromCache()
    if (restored) {
      console.log('[Wardrobe onActivated] Restored items from sessionStorage, count:', uploadedItems.value.length)
    } else {
      // Only load if we haven't tried loading before (check sessionStorage flag)
      const hasTriedLoading = sessionStorage.getItem('wardrobe_load_attempted') === 'true'
      if (!hasTriedLoading && !hasLoadedItems.value) {
        console.log('[Wardrobe onActivated] No cached data, loading items...')
        sessionStorage.setItem('wardrobe_load_attempted', 'true')
        loadUserItems()
      } else {
        console.log('[Wardrobe onActivated] Already attempted loading, skipping to avoid repeated failures')
      }
    }
  } else {
    console.log('[Wardrobe onActivated] Using cached data, items count:', uploadedItems.value.length)
  }
  
  console.log('[Wardrobe onActivated] Reloaded outfit selection from localStorage')
})

// Watch for route changes to reload selection when navigating to this page
watch(() => route.name, (newName) => {
  if (newName === 'wardrobe') {
    loadOutfitSelection()
    console.log('[Wardrobe watch route] Reloaded outfit selection from localStorage')
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

</script>

<template>
  <div class="min-h-screen bg-green-50/20 font-sans text-green-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-8 flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight text-green-800">My Wardrobe</h1>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <!-- Upload -->
      <section class="bg-white p-6 rounded-2xl shadow-sm border border-green-100">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2 text-green-800">
          <Upload class="w-5 h-5" />
          Add Wardrobe Items
        </h2>
        <div
          class="border-2 border-dashed border-green-200 rounded-xl p-8 text-center hover:border-green-600 transition-colors cursor-pointer relative bg-green-50 hover:bg-green-100"
          @click="triggerFileInput"
        >
          <input
            ref="fileInputRef"
            type="file"
            @change="handleFileUpload"
            class="hidden"
            accept="image/*"
            multiple
          />
          <div v-if="isUploading && uploadProgress" class="flex flex-col items-center gap-2 pointer-events-none">
            <div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span class="text-sm text-gray-500">
              Uploading {{ uploadProgress.current }}/{{ uploadProgress.total }}
            </span>
            <span class="text-xs text-gray-400">{{ uploadProgress.currentFile }}</span>
          </div>
          <div v-else-if="isUploading" class="flex flex-col items-center gap-2 pointer-events-none">
            <div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span class="text-sm text-gray-500">Analyzing...</span>
          </div>
          <div v-else class="pointer-events-none">
            <p class="font-medium text-green-700">Click or drag to upload</p>
            <p class="text-xs text-green-600 mt-2">You can select multiple photos (JPG, PNG, WEBP, AVIF)</p>
          </div>
        </div>
        
        <!-- URL Upload -->
        <div class="mt-4 pt-4 border-t border-green-200">
          <p class="text-sm font-medium text-green-700 mb-2">Or add via URL</p>
          <div class="flex gap-2">
            <input
              v-model="imageUrlInput"
              type="text"
              placeholder="Enter a public image URL (http:// or https://)"
              class="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              :disabled="isUploadingUrl || isUploading"
              @keyup.enter="handleUrlUpload"
            />
            <button
              @click="handleUrlUpload"
              :disabled="isUploadingUrl || isUploading || !imageUrlInput.trim()"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span v-if="isUploadingUrl">Uploading...</span>
              <span v-else>Upload</span>
              <div v-if="isUploadingUrl" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </button>
          </div>
        </div>
      </section>

      <!-- Wardrobe Grid -->
      <section class="bg-white p-6 rounded-2xl shadow-sm border border-green-100 min-h-[400px]">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold flex items-center gap-2 text-green-800">
            <Shirt class="w-5 h-5" />
            My Wardrobe
            <span v-if="uploadedItems.length > 0" class="text-sm font-normal text-green-600 ml-2">
              ({{ uploadedItems.length }} items)
            </span>
          </h2>
          <div class="flex items-center gap-2">
            <button
              @click="loadUserItems"
              :disabled="isLoadingItems"
              class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Refresh data"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoadingItems }" />
              <span>Refresh</span>
            </button>
            <button
              @click="toggleSelectionMode"
              class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
              :class="isSelectionMode ? 'bg-green-600 text-white border-green-600' : 'border-green-200 text-green-600 hover:border-green-600'"
            >
              {{ isSelectionMode ? 'Cancel selection' : 'Bulk select' }}
            </button>
            <button
              v-if="isSelectionMode && selectedCount > 0"
              @click="deleteSelectedItems"
              :disabled="isDeleting"
              class="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Trash2 class="w-4 h-4" />
              <span>Delete ({{ selectedCount }})</span>
            </button>
          </div>
        </div>
        <div v-if="isSelectionMode" class="mb-4 flex items-center gap-2">
          <button
            @click="toggleSelectAll"
            class="px-3 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:border-black transition-colors"
          >
            {{ isAllSelected ? 'Unselect all' : 'Select all' }}
          </button>
          <span class="text-sm text-gray-500">Selected {{ selectedCount }} / {{ filteredItems.length }} items</span>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="filter in typeFilters"
            :key="filter"
            @click="selectedFilter = filter"
            class="px-3 py-1 text-sm rounded-full border transition-colors"
            :class="selectedFilter === filter ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-black'"
          >
            {{ filter }}
          </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div
            v-for="(item, index) in filteredItems"
            :key="item.id"
            @click="isSelectionMode ? toggleItemSelection(String(item.id), $event) : openImageViewer(index, $event)"
            class="group relative rounded-xl overflow-hidden border aspect-[3/4] cursor-pointer transition-all hover:shadow-md"
            :class="isSelectionMode && selectedItemIds.has(String(item.id)) ? 'border-green-500 border-2 ring-2 ring-green-200' : 'border-green-200'"
          >
            <!-- Selection checkbox -->
            <div
              v-if="isSelectionMode"
              class="absolute top-2 left-2 z-10"
              @click.stop="toggleItemSelection(String(item.id), $event)"
            >
              <div
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                :class="selectedItemIds.has(String(item.id)) ? 'bg-green-500 border-green-500' : 'bg-white/90 border-green-300'"
              >
                <svg
                  v-if="selectedItemIds.has(String(item.id))"
                  class="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <img
              v-if="item.url || item.features.path"
              :src="item.url || item.features.path"
              class="absolute inset-0 w-full h-full object-cover"
              :class="isSelectionMode && selectedItemIds.has(String(item.id)) ? 'opacity-75' : ''"
              alt="Clothing item"
            />
            <div v-else class="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400">
              <span class="text-xs">{{ item.features.type }}</span>
            </div>

            <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs translate-y-full group-hover:translate-y-0 transition-transform">
              {{ formatFeatureValue(item.features.color) }}
            </div>

            <!-- Outfit Selection Toggle (Top-Right) -->
            <button
              v-if="!isSelectionMode"
              @click.stop="toggleOutfitSelection(String(item.id), $event)"
              class="absolute top-2 right-2 z-10 p-1 rounded-full transition-all duration-200"
              :class="isOutfitSelected(String(item.id)) ? 'bg-green-600 text-white opacity-100 shadow-md' : 'bg-white/80 text-green-400 opacity-0 group-hover:opacity-100 hover:text-green-900 hover:bg-white'"
              title="Add to Outfit Generator"
            >
              <CheckCircle v-if="isOutfitSelected(String(item.id))" class="w-5 h-5 fill-current" />
              <div v-else class="w-5 h-5 rounded-full border-2 border-current"></div>
            </button>
          </div>

          <div
            v-if="filteredItems.length === 0"
            class="col-span-full flex flex-col items-center justify-center text-green-600 py-12"
          >
            <Shirt class="w-12 h-12 mb-2 opacity-20" />
            <p class="text-sm" v-if="uploadedItems.length === 0">No items yet.</p>
            <p class="text-sm" v-else>No items match the "{{ selectedFilter }}" filter.</p>
          </div>
        </div>
      </section>

      <!-- Confirmation Dialog for Multiple Items -->
      <div
        v-if="showConfirmDialog"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="cancelAddItems"
      >
        <div class="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
          <div class="p-6 border-b border-gray-200">
            <h3 class="text-xl font-bold">Multiple Items Detected</h3>
            <p class="text-sm text-gray-500 mt-1">Please review and select the items you want to add to your wardrobe.</p>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <div class="space-y-4">
              <div
                v-for="(item, index) in pendingItems"
                :key="index"
                class="border border-gray-200 rounded-xl p-4 hover:border-black transition-colors"
                :class="{ 'bg-gray-50': item.selected }"
              >
                <div class="flex items-start gap-4">
                  <input
                    type="checkbox"
                    v-model="item.selected"
                    class="mt-1 w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h4 class="font-semibold">{{ formatFeatureValue(item.features.type) }}</h4>
                      <span class="text-sm text-gray-500">{{ formatFeatureValue(item.features.color) }}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div><span class="font-medium">Style:</span> {{ formatFeatureValue(item.features.style) }}</div>
                      <div><span class="font-medium">Occasion:</span> {{ formatFeatureValue(item.features.occasion) }}</div>
                      <div><span class="font-medium">Pattern:</span> {{ formatFeatureValue(item.features.pattern) }}</div>
                      <div><span class="font-medium">Material:</span> {{ formatFeatureValue(item.features.material) }}</div>
                    </div>
                  </div>
                  <img
                    v-if="item.url"
                    :src="item.url"
                    class="w-16 h-16 object-cover rounded-lg"
                    alt="Item preview"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              @click="cancelAddItems"
              class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirmAddItems"
              :disabled="isConfirming"
              class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>{{ isConfirming ? 'Adding...' : `Add Selected (${pendingItems.filter(i => i.selected).length})` }}</span>
              <span v-if="isConfirming" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            </button>
          </div>
          <p v-if="isConfirming" class="text-sm text-gray-500 text-center pb-4">
            Uploading items… hang tight, this may take a few seconds.
          </p>
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
            alt="Wardrobe item"
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


