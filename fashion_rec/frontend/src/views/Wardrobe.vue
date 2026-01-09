<script setup lang="ts">
defineOptions({ name: 'Wardrobe' })
import { ref, onMounted, onUnmounted, onActivated, watch, computed } from 'vue'
import { Upload, Shirt, X, ChevronLeft, ChevronRight, Trash2, RefreshCw, CheckCircle, Info, Edit2, Save } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import type { Item, PendingItem, ItemFeatures } from '../types'
import { apiClient, uploadApiClient, longUploadApiClient } from '../lib/api-client'
import { API_URL } from '../config/api'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const route = useRoute()

const uploadedItems = ref<Item[]>([])
const hasLoadedItems = ref(false)
const typeFilters = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Shoes', 'Accessories', 'Sportswear', 'Traditional']
const selectedFilter = ref('All')
const isUploading = ref(false)
const uploadProgress = ref<{ current: number; total: number; currentFile: string } | null>(null)
const pendingItems = ref<PendingItem[]>([])
const selectedPendingIndex = ref<number | null>(null)
const showConfirmDialog = ref(false)
const isConfirming = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedFileSignatures = new Set<string>()
const pendingUploadSignatures = new Set<string>()
const imageUrlInput = ref('')
const isUploadingUrl = ref(false)
const urlUploadProgress = ref<{ current: number; total: number; currentUrl: string } | null>(null)
const isImporting = ref(false)

// Gender constants for import example items
const GENDER_WOMENS = "Women's"
const GENDER_MENS = "Man's"

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
    uploadedItems.value = response.data.items.map((item, index) => {
      // Debug: log first item to check data structure
      if (index === 0) {
        console.log('[Wardrobe] First item data from backend (full):', JSON.parse(JSON.stringify(item)))
        console.log('[Wardrobe] Gender value:', item.gender, 'Type:', typeof item.gender, 'Has key:', 'gender' in item)
        console.log('[Wardrobe] Description value:', item.description, 'Type:', typeof item.description, 'Has key:', 'description' in item)
      }
      // Always include gender and description fields, even if they are null/undefined from backend
      // Backend should always return these fields, but handle cases where they might be missing
      // Note: Backend defaults gender to "Unisex" if None, so it should always have a value
      const genderValue = (item.gender !== undefined && item.gender !== null && item.gender !== '') 
        ? item.gender 
        : (item.gender === null || item.gender === undefined ? "Unisex" : null)  // Default to "Unisex" like backend
      const descriptionValue = (item.description !== undefined && item.description !== null && item.description !== '') 
        ? item.description 
        : null
      
      // Debug: log if fields are missing
      if (index === 0) {
        console.log('[Wardrobe] Mapping item - gender:', genderValue, 'description:', descriptionValue)
      }
      
      return {
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
          gender: genderValue,  // Always include, defaults to "Unisex" if missing
          description: descriptionValue,  // Always include, will be null if not present
        },
      }
    })
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
    // Default to first item selected for single selection
    selectedPendingIndex.value = 0
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
  const inputText = imageUrlInput.value.trim()
  
  if (!inputText) {
    alert('Please enter at least one image URL')
    return
  }
  
  // Parse multiple URLs (split by newlines)
  const urlLines = inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  if (urlLines.length === 0) {
    alert('Please enter at least one valid URL')
    return
  }
  
  // Validate all URLs
  const validUrls: string[] = []
  const invalidUrls: string[] = []
  
  for (const url of urlLines) {
    try {
      new URL(url)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        invalidUrls.push(`${url} (must start with http:// or https://)`)
        continue
      }
      validUrls.push(url)
    } catch {
      invalidUrls.push(`${url} (invalid URL format)`)
    }
  }
  
  if (invalidUrls.length > 0) {
    alert(`Invalid URLs:\n${invalidUrls.join('\n')}\n\nPlease fix these URLs and try again.`)
    return
  }
  
  // Check for duplicate URLs in input
  const uniqueUrls = Array.from(new Set(validUrls))
  if (uniqueUrls.length !== validUrls.length) {
    const duplicates = validUrls.length - uniqueUrls.length
    if (!confirm(`Found ${duplicates} duplicate URL(s) in your input. Continue with unique URLs only?`)) {
      return
    }
  }
  
  // Check for already uploaded URLs
  const newUrls: string[] = []
  const alreadyUploadedUrls: string[] = []
  
  for (const url of uniqueUrls) {
    if (uploadedFileSignatures.has(url) || pendingUploadSignatures.has(url)) {
      alreadyUploadedUrls.push(url)
    } else {
      newUrls.push(url)
    }
  }
  
  if (alreadyUploadedUrls.length > 0) {
    const message = `The following URL(s) were already uploaded:\n${alreadyUploadedUrls.slice(0, 5).join('\n')}${alreadyUploadedUrls.length > 5 ? `\n... and ${alreadyUploadedUrls.length - 5} more` : ''}\n\nContinue with remaining URLs?`
    if (!confirm(message)) {
      return
    }
  }
  
  if (newUrls.length === 0) {
    alert('All URLs have already been uploaded.')
    return
  }
  
  isUploadingUrl.value = true
  urlUploadProgress.value = {
    current: 0,
    total: newUrls.length,
    currentUrl: newUrls[0] || '',
  }
  
  const successfulUploads: Item[] = []
  const failedUploads: { url: string; error: string }[] = []
  const allPendingItems: PendingItem[] = []
  
  for (let i = 0; i < newUrls.length; i++) {
    const url = newUrls[i]
    
    urlUploadProgress.value = {
      current: i + 1,
      total: newUrls.length,
      currentUrl: url,
    }
    
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
        successfulUploads.push(...response.data.items)
      } else {
        // Collect pending items instead of immediately showing dialog
        const pending: PendingItem[] = response.data.items.map((item) => ({
          ...item,
        }))
        allPendingItems.push(...pending)
      }
      uploadedFileSignatures.add(url)
    } catch (error: any) {
      console.error(`URL upload failed for ${url}:`, error)
      let errorMessage = 'Upload failed'
      
      // Handle connection refused error specifically
      if (error?.code === 'ERR_CONNECTION_REFUSED' || error?.message?.includes('Connection refused') || error?.message?.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = `Cannot reach backend (${API_URL})`
      } else if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error') || error?.message?.includes('ERR_CONNECTION_RESET')) {
        errorMessage = 'Network error or connection reset'
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        errorMessage = 'Request timed out (waited 10 minutes)'
      } else if (error?.response?.status === 500) {
        const backendError = error?.response?.data?.detail || error?.response?.data?.message || 'Server internal error'
        errorMessage = `Server error (500): ${backendError}`
      } else if (error?.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      failedUploads.push({ url, error: errorMessage })
    } finally {
      pendingUploadSignatures.delete(url)
    }
  }
  
  // Show confirmation dialog only after all URLs are processed
  if (allPendingItems.length > 0) {
    pendingItems.value.push(...allPendingItems)
    // Default to first item selected for single selection
    selectedPendingIndex.value = 0
    showConfirmDialog.value = true
  }
  
  // Refresh data if there were successful uploads
  if (successfulUploads.length > 0) {
    await loadUserItems()
  }
  
  // Show success/failure messages
  if (successfulUploads.length > 0 && failedUploads.length === 0 && allPendingItems.length === 0) {
    console.log(`Successfully uploaded ${successfulUploads.length} URL(s)`)
  } else if (successfulUploads.length > 0 && failedUploads.length > 0) {
    alert(
      `Uploaded ${successfulUploads.length} URL(s) successfully.\n\nFailed:\n${failedUploads
        .map((f) => `${f.url}: ${f.error}`)
        .join('\n')}`,
    )
  } else if (failedUploads.length > 0 && successfulUploads.length === 0 && allPendingItems.length === 0) {
    alert(
      `All uploads failed:\n${failedUploads
        .map((f) => `${f.url}: ${f.error}`)
        .join('\n')}`,
    )
  }
  
  imageUrlInput.value = ''
  isUploadingUrl.value = false
  urlUploadProgress.value = null
}

const confirmAddItems = async () => {
  if (selectedPendingIndex.value === null || selectedPendingIndex.value < 0 || selectedPendingIndex.value >= pendingItems.value.length) {
    alert('Please select an item to add')
    return
  }

  const selectedItem = pendingItems.value[selectedPendingIndex.value]

  try {
    isConfirming.value = true
    // Use uploadApiClient for batch operations as they may take longer
    await uploadApiClient.post<{ items: Item[] }>('/items/batch', [selectedItem])
    
    // Refresh data to ensure consistency
    await loadUserItems()
    console.log(`Added 1 item to wardrobe`)

    pendingItems.value = []
    selectedPendingIndex.value = null
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
  selectedPendingIndex.value = null
  showConfirmDialog.value = false
}

const importExampleItems = async (gender: string) => {
  isImporting.value = true
  try {
    const formData = new FormData()
    formData.append('gender', gender)
    
    const response = await apiClient.post<{ message: string; imported_count: number; skipped_count: number }>(
      '/items/import-examples',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    
    const genderLabel = gender === GENDER_MENS ? '男装' : gender === GENDER_WOMENS ? '女装' : '中性装'
    
    
    // 刷新衣橱列表
    await loadUserItems()
  } catch (error: any) {
    console.error('导入示例数据失败:', error)
    const errorMessage = error?.response?.data?.detail || error?.message || 'Import failed'
    alert(`Import failed: ${errorMessage}`)
  } finally {
    isImporting.value = false
  }
}

const formatFeatureValue = (value: string | string[] | undefined | null): string => {
  if (!value && value !== '') return 'Unknown'
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value)
}

// Helper to check if a value exists (including empty string)
const hasValue = (value: any): boolean => {
  return value !== null && value !== undefined && value !== ''
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

  const itemIdsArray = Array.from(selectedItemIds.value)
  
  // 乐观更新：先保存要删除的物品，用于可能的回滚
  const itemsToDelete = uploadedItems.value.filter(item => 
    itemIdsArray.includes(String(item.id))
  )
  
  // 立即从UI中删除（乐观更新）
  uploadedItems.value = uploadedItems.value.filter(item => 
    !itemIdsArray.includes(String(item.id))
  )
  
  // 更新缓存
  saveItemsToCache()
  
  // 清除选择状态并退出选择模式
  selectedItemIds.value.clear()
  isSelectionMode.value = false
  
  // 异步调用后端删除（不阻塞UI）
  isDeleting.value = true
  apiClient.post<{ deleted_count: number; message: string }>('/items/delete', {
    item_ids: itemIdsArray
  }).then(() => {
    // 删除成功，无需额外操作（UI已经更新）
    console.log(`Successfully deleted ${itemIdsArray.length} items`)
  }).catch((error: any) => {
    // 删除失败，回滚UI
    console.error('Failed to delete items:', error)
    const errorMessage = error?.response?.data?.detail || error?.message || 'Delete failed'
    
    // 恢复被删除的物品
    uploadedItems.value = [...uploadedItems.value, ...itemsToDelete]
    saveItemsToCache()
    
    // 显示错误提示
    alert(`删除失败: ${errorMessage}\n\n物品已恢复。`)
  }).finally(() => {
    isDeleting.value = false
  })
}

// Image viewer for wardrobe items
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])

// Sheet for displaying item details
const showItemDetailsSheet = ref(false)
const isEditingItem = ref(false)
const editedFeatures = ref<Partial<ItemFeatures>>({})
const isUpdatingItem = ref(false)

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
  // Also close the item details sheet when closing image viewer
  showItemDetailsSheet.value = false
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

// Get current item based on current image index
const currentItem = computed(() => {
  if (!showImageViewer.value || imageViewerImages.value.length === 0) {
    return null
  }
  
  const currentImageUrl = imageViewerImages.value[currentImageIndex.value]
  if (!currentImageUrl) return null
  
  // Find the item that matches the current image URL
  const item = filteredItems.value.find(
    item => (item.url || item.features.path) === currentImageUrl
  ) || null
  
  // Debug: log item data to check gender and description
  if (item) {
    console.log('[Wardrobe] Current item data:', {
      id: item.id,
      gender: item.features.gender,
      description: item.features.description,
      allFeatures: item.features
    })
  }
  
  return item
})

// Open item details sheet
const openItemDetailsSheet = () => {
  if (currentItem.value) {
    showItemDetailsSheet.value = true
    isEditingItem.value = false
    // Initialize edited features with current item features
    editedFeatures.value = {
      type: currentItem.value.features.type,
      color: currentItem.value.features.color,
      style: currentItem.value.features.style,
      pattern: currentItem.value.features.pattern,
      occasion: currentItem.value.features.occasion,
      material: currentItem.value.features.material,
      gender: currentItem.value.features.gender,
      description: currentItem.value.features.description,
    }
  }
}

// Start editing item
const startEditingItem = () => {
  if (currentItem.value) {
    isEditingItem.value = true
  }
}

// Cancel editing
const cancelEditingItem = () => {
  if (currentItem.value) {
    // Restore original values
    editedFeatures.value = {
      type: currentItem.value.features.type,
      color: currentItem.value.features.color,
      style: currentItem.value.features.style,
      pattern: currentItem.value.features.pattern,
      occasion: currentItem.value.features.occasion,
      material: currentItem.value.features.material,
      gender: currentItem.value.features.gender,
      description: currentItem.value.features.description,
    }
    isEditingItem.value = false
  }
}

// Save item updates
const saveItemUpdates = async () => {
  if (!currentItem.value || !currentItem.value.id) {
    alert('无法保存：物品ID不存在')
    return
  }

  isUpdatingItem.value = true
  try {
    await apiClient.put<{ message: string; item_id: string }>(
      `/items/${currentItem.value.id}`,
      {
        features: editedFeatures.value
      }
    )

    // Update local state optimistically
    if (currentItem.value) {
      Object.assign(currentItem.value.features, editedFeatures.value)
    }
    
    // Update in uploadedItems array
    const itemIndex = uploadedItems.value.findIndex(item => item.id === currentItem.value?.id)
    if (itemIndex !== -1) {
      Object.assign(uploadedItems.value[itemIndex].features, editedFeatures.value)
      saveItemsToCache()
    }

    isEditingItem.value = false
  } catch (error: any) {
    console.error('Failed to update item:', error)
    const errorMessage = error?.response?.data?.detail || error?.message || 'Update failed'
    alert(`Update failed: ${errorMessage}`)
    // Restore original values on error
    cancelEditingItem()
  } finally {
    isUpdatingItem.value = false
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
  // Detect if this is a page refresh (manual reload)
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  const isPageRefresh = navigation?.type === 'reload' || 
    (typeof (performance as any).navigation !== 'undefined' && (performance as any).navigation.type === 1)
  
  if (isPageRefresh) {
    // Manual page refresh: clear cache and force reload from server
    console.log('[Wardrobe] Page refresh detected, clearing cache and loading fresh data from server...')
    try {
      sessionStorage.removeItem('wardrobe_items_cache')
      sessionStorage.removeItem('wardrobe_load_attempted')
    } catch (e) {
      console.warn('[Wardrobe] Failed to clear cache:', e)
    }
    hasLoadedItems.value = false
    uploadedItems.value = []
    loadUserItems()
  } else {
    // Normal mount: try to restore from cache first
    if (uploadedItems.value.length === 0) {
      restoreItemsFromCache()
    }
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
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-8 flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">My Wardrobe</h1>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <!-- Upload -->
      <section class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          <Upload class="w-5 h-5" />
          Add Wardrobe Items
        </h2>
        <div
          class="border-2 border-dashed border-pink-200 rounded-xl p-8 text-center hover:border-pink-600 transition-colors cursor-pointer relative bg-pink-50 hover:bg-pink-100"
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
            <span class="text-sm text-pink-500">
              Uploading {{ uploadProgress.current }}/{{ uploadProgress.total }}
            </span>
            <span class="text-xs text-pink-400">{{ uploadProgress.currentFile }}</span>
          </div>
          <div v-else-if="isUploading" class="flex flex-col items-center gap-2 pointer-events-none">
            <div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            <span class="text-sm text-pink-500">Analyzing...</span>
          </div>
          <div v-else class="pointer-events-none">
            <p class="font-medium text-gray-700">Click or drag to upload</p>
            <p class="text-xs text-pink-600 mt-2">You can select multiple photos (JPG, PNG, WEBP, AVIF)</p>
          </div>
        </div>
        
        <!-- URL Upload -->
        <div class="mt-4 pt-4 border-t border-pink-200">
          <p class="text-sm font-medium text-gray-700 mb-2">Or add via URL (one URL per line)</p>
          <div class="space-y-2">
            <textarea
              v-model="imageUrlInput"
              placeholder="Enter one or more image URLs, one per line:&#10;https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
              rows="4"
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-y font-mono text-sm"
              :disabled="isUploadingUrl || isUploading"
            ></textarea>
            <div v-if="isUploadingUrl && urlUploadProgress" class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm text-pink-500">
                  Uploading {{ urlUploadProgress.current }}/{{ urlUploadProgress.total }}
                </span>
              </div>
              <span class="text-xs text-pink-400 truncate">{{ urlUploadProgress.currentUrl }}</span>
            </div>
            <div class="flex gap-2">
              <button
                @click="handleUrlUpload"
                :disabled="isUploadingUrl || isUploading || !imageUrlInput.trim()"
                class="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span v-if="isUploadingUrl">Uploading...</span>
                <span v-else>Upload URL(s)</span>
                <div v-if="isUploadingUrl" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 导入示例数据 -->
        <div class="mt-4 pt-4 border-t border-pink-200">
          <p class="text-sm font-medium text-gray-700 mb-2">Or import sample products</p>
          <div class="flex gap-2">
            <button
              @click="importExampleItems(GENDER_WOMENS)"
              :disabled="isImporting"
              class="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span v-if="isImporting">Importing...</span>
              <span v-else>Import Women's sample</span>
              <div v-if="isImporting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </button>
            <button
              @click="importExampleItems(GENDER_MENS)"
              :disabled="isImporting"
              class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span v-if="isImporting">Importing...</span>
              <span v-else>Import Men's sample</span>
              <div v-if="isImporting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </button>
          </div>
        </div>
      </section>

      <!-- Wardrobe Grid -->
      <section class="bg-white p-6 rounded-2xl shadow-sm border border-pink-100 min-h-[400px]">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            <Shirt class="w-5 h-5" />
            My Wardrobe
            <span v-if="uploadedItems.length > 0" class="text-sm font-normal text-pink-600 ml-2">
              ({{ uploadedItems.length }} items)
            </span>
          </h2>
          <div class="flex items-center gap-2">
            <button
              @click="loadUserItems"
              :disabled="isLoadingItems"
              class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-pink-600 hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Refresh data"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoadingItems }" />
              <span>Refresh</span>
            </button>
            <button
              @click="toggleSelectionMode"
              class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
              :class="isSelectionMode ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-600' : 'border-pink-200 text-pink-600 hover:border-pink-600'"
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
            class="px-3 py-1 text-xs rounded-lg border border-gray-200 text-pink-600 hover:border-black transition-colors"
          >
            {{ isAllSelected ? 'Unselect all' : 'Select all' }}
          </button>
          <span class="text-sm text-pink-500">Selected {{ selectedCount }} / {{ filteredItems.length }} items</span>
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="filter in typeFilters"
            :key="filter"
            @click="selectedFilter = filter"
            class="px-3 py-1 text-sm rounded-full border transition-colors"
            :class="selectedFilter === filter ? 'bg-black text-white border-black' : 'border-gray-200 text-pink-600 hover:border-black'"
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
            :class="isSelectionMode && selectedItemIds.has(String(item.id)) ? 'border-pink-500 border-2 ring-2 ring-pink-200' : 'border-pink-200'"
          >
            <!-- Selection checkbox -->
            <div
              v-if="isSelectionMode"
              class="absolute top-2 left-2 z-10"
              @click.stop="toggleItemSelection(String(item.id), $event)"
            >
              <div
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                :class="selectedItemIds.has(String(item.id)) ? 'bg-pink-500 border-pink-500' : 'bg-white/90 border-pink-300'"
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
            <div v-else class="absolute inset-0 bg-gray-100 flex items-center justify-center text-pink-400">
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
              :class="isOutfitSelected(String(item.id)) ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white opacity-100 shadow-md' : 'bg-white/80 text-pink-400 opacity-0 group-hover:opacity-100 hover:text-pink-700 hover:bg-white'"
              title="Add to Outfit Generator"
            >
              <CheckCircle v-if="isOutfitSelected(String(item.id))" class="w-5 h-5 fill-current" />
              <div v-else class="w-5 h-5 rounded-full border-2 border-current"></div>
            </button>
          </div>

          <div
            v-if="filteredItems.length === 0"
            class="col-span-full flex flex-col items-center justify-center text-pink-600 py-12"
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
            <p class="text-sm text-pink-500 mt-1">Please review and select one item you want to add to your wardrobe.</p>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <div class="space-y-4">
              <div
                v-for="(item, index) in pendingItems"
                :key="index"
                class="border border-gray-200 rounded-xl p-4 hover:border-black transition-colors cursor-pointer"
                :class="{ 'bg-gray-50 border-black': selectedPendingIndex === index }"
                @click="selectedPendingIndex = index"
              >
                <div class="flex items-start gap-4">
                  <input
                    type="radio"
                    :value="index"
                    v-model="selectedPendingIndex"
                    class="mt-1 w-4 h-4 text-black border-gray-300 focus:ring-black"
                    @click.stop
                  />
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h4 class="font-semibold">{{ formatFeatureValue(item.features.type) }}</h4>
                      <span class="text-sm text-pink-500">{{ formatFeatureValue(item.features.color) }}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs text-pink-600">
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
              :disabled="isConfirming || selectedPendingIndex === null"
              class="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>{{ isConfirming ? 'Adding...' : 'Add Selected Item' }}</span>
              <span v-if="isConfirming" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            </button>
          </div>
          <p v-if="isConfirming" class="text-sm text-pink-500 text-center pb-4">
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
        
        <!-- Info button to show item details -->
        <button
          v-if="currentItem"
          @click="openItemDetailsSheet"
          class="absolute top-4 left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
          title="View item details"
        >
          <Info class="w-6 h-6" />
        </button>
        
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
    
    <!-- Item Details Sheet -->
    <Sheet v-model:open="showItemDetailsSheet">
      <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader v-if="currentItem">
          <div class="flex items-center justify-between">
            <div>
              <SheetTitle>Item Details</SheetTitle>
              <SheetDescription>
                {{ isEditingItem ? 'Edit item information' : 'Detailed information about this clothing item' }}
              </SheetDescription>
            </div>
            <div v-if="!isEditingItem" class="flex gap-2">
              <button
                @click="startEditingItem"
                class="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit item"
              >
                <Edit2 class="w-5 h-5" />
              </button>
            </div>
          </div>
        </SheetHeader>
        
        <div v-if="currentItem" class="mt-6 space-y-6">
          <!-- Item Image -->
          <div class="flex justify-center">
            <img
              :src="currentItem.url || currentItem.features.path"
              :alt="formatFeatureValue(currentItem.features.type)"
              class="w-full max-w-sm rounded-lg object-cover shadow-lg"
            />
          </div>
          
          <!-- Item Information -->
          <div class="space-y-4">
            <!-- Type -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Type</label>
              <p v-if="!isEditingItem" class="mt-1 text-base font-semibold text-gray-900">{{ formatFeatureValue(currentItem.features.type) }}</p>
              <input
                v-else
                v-model="editedFeatures.type"
                @input="editedFeatures.type = ($event.target as HTMLInputElement).value"
                type="text"
                class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base"
                placeholder="e.g., T-shirt, Jeans, Dress"
              />
            </div>
            
            <!-- Color -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Color</label>
              <p v-if="!isEditingItem" class="mt-1 text-base text-gray-900">{{ formatFeatureValue(currentItem.features.color) }}</p>
              <input
                v-else
                v-model="editedFeatures.color"
                @input="editedFeatures.color = ($event.target as HTMLInputElement).value"
                type="text"
                class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base"
                placeholder="e.g., Blue, Red, Black, White"
              />
            </div>
            
            <!-- Style -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Style</label>
              <p v-if="!isEditingItem && currentItem.features.style" class="mt-1 text-base text-gray-900">{{ formatFeatureValue(currentItem.features.style) }}</p>
              <p v-else-if="!isEditingItem" class="mt-1 text-base text-gray-400 italic">Not specified</p>
              <input
                v-else
                v-model="editedFeatures.style"
                @input="editedFeatures.style = ($event.target as HTMLInputElement).value || undefined"
                type="text"
                class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base"
                placeholder="e.g., Casual, Formal, Streetwear"
              />
            </div>
            
            <!-- Pattern -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Pattern</label>
              <p v-if="!isEditingItem && currentItem.features.pattern" class="mt-1 text-base text-gray-900">{{ formatFeatureValue(currentItem.features.pattern) }}</p>
              <p v-else-if="!isEditingItem" class="mt-1 text-base text-gray-400 italic">Not specified</p>
              <input
                v-else
                v-model="editedFeatures.pattern"
                @input="editedFeatures.pattern = ($event.target as HTMLInputElement).value || undefined"
                type="text"
                class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base"
                placeholder="e.g., Solid, Striped, Floral"
              />
            </div>
            
            <!-- Occasion -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Occasion</label>
              <p v-if="!isEditingItem && currentItem.features.occasion" class="mt-1 text-base text-gray-900">{{ formatFeatureValue(currentItem.features.occasion) }}</p>
              <p v-else-if="!isEditingItem" class="mt-1 text-base text-gray-400 italic">Not specified</p>
              <input
                v-else
                v-model="editedFeatures.occasion"
                @input="editedFeatures.occasion = ($event.target as HTMLInputElement).value || undefined"
                type="text"
                class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base"
                placeholder="e.g., Daily, Work, Formal"
              />
            </div>
            
            <!-- Material -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Material</label>
              <p v-if="!isEditingItem && currentItem.features.material" class="mt-1 text-base text-gray-900">{{ formatFeatureValue(currentItem.features.material) }}</p>
              <p v-else-if="!isEditingItem" class="mt-1 text-base text-gray-400 italic">Not specified</p>
              <input
                v-else
                v-model="editedFeatures.material"
                @input="editedFeatures.material = ($event.target as HTMLInputElement).value || undefined"
                type="text"
                class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base"
                placeholder="e.g., Cotton, Denim, Silk"
              />
            </div>
            
            <!-- Gender -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Gender</label>
              <p v-if="!isEditingItem && hasValue(currentItem.features.gender)" class="mt-1 text-base text-gray-900">{{ currentItem.features.gender }}</p>
              <p v-else-if="!isEditingItem" class="mt-1 text-base text-gray-400 italic">Not specified</p>
              <Select
                v-else
                v-model="editedFeatures.gender"
              >
                <SelectTrigger class="mt-1 w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Man's">
                    Man's
                  </SelectItem>
                  <SelectItem value="Women's">
                    Women's
                  </SelectItem>
                  <SelectItem value="Unisex">
                    Unisex
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <!-- Description -->
            <div class="border-b border-gray-200 pb-3">
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Description</label>
              <p v-if="!isEditingItem && hasValue(currentItem.features.description)" class="mt-1 text-base text-gray-900 whitespace-pre-wrap">{{ currentItem.features.description }}</p>
              <p v-else-if="!isEditingItem" class="mt-1 text-base text-gray-400 italic">Not specified</p>
              <textarea
                v-else
                v-model="editedFeatures.description"
                @input="editedFeatures.description = ($event.target as HTMLTextAreaElement).value || undefined"
                rows="4"
                class="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base resize-y"
                placeholder="Enter a detailed description of this clothing item..."
              ></textarea>
            </div>
          </div>
          
          <!-- Edit Actions -->
          <div v-if="isEditingItem" class="flex gap-3 pt-4 border-t border-gray-200">
            <button
              @click="cancelEditingItem"
              :disabled="isUpdatingItem"
              class="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              @click="saveItemUpdates"
              :disabled="isUpdatingItem"
              class="flex-1 px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save class="w-4 h-4" />
              <span>{{ isUpdatingItem ? 'Saving...' : 'Save' }}</span>
            </button>
          </div>
        </div>
        
        <div v-else class="mt-6 text-center text-gray-500">
          <p>No item information available</p>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>


