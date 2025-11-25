<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Upload, Shirt, Wand2, LogOut } from 'lucide-vue-next'
import axios from 'axios'
import { useRouter } from 'vue-router'
import type { Item, Recommendation, PendingItem } from '../types'

const router = useRouter()
const API_URL = 'http://localhost:8000'

// 创建配置了认证头的 axios 实例
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 添加请求拦截器，自动添加认证 token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const uploadedItems = ref<Item[]>([])
const isUploading = ref(false)
const uploadProgress = ref<{ current: number; total: number; currentFile: string } | null>(null)
const pendingItems = ref<PendingItem[]>([]) // Items waiting for user confirmation
const showConfirmDialog = ref(false)
const selectedItem = ref<Item | null>(null)
const recommendations = ref<Recommendation[]>([])
const isGenerating = ref(false)
const occasion = ref('Casual')
const occasions = ['Casual', 'Business', 'Party', 'Sport', 'Date']
const fileInputRef = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

// Load user's items from backend
const loadUserItems = async () => {
  try {
    const response = await apiClient.get<{ items: any[] }>('/items')
    // Convert backend items to frontend Item format
    uploadedItems.value = response.data.items.map(item => ({
      id: item.id,
      url: item.path,
      features: {
        path: item.path,
        type: item.type || 'Unknown',
        color: item.color || 'Unknown',
        style: item.style || 'Unknown',
        pattern: item.pattern,
        occasion: item.occasion,
        material: item.material,
      }
    }))
    console.log('Loaded user items:', uploadedItems.value.length)
  } catch (error: any) {
    console.error('Failed to load user items:', error)
    // Don't show alert on initial load failure, just log it
  }
}

// Load items when component mounts
onMounted(() => {
  loadUserItems()
})

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  
  if (!files || files.length === 0) {
    console.warn('No files selected')
    return
  }

  // Convert FileList to Array and validate all files
  const fileArray = Array.from(files)
  const maxSize = 10 * 1024 * 1024 // 10MB
  const invalidFiles: string[] = []

  // Validate all files first
  for (const file of fileArray) {
    if (!file.type.startsWith('image/')) {
      invalidFiles.push(`${file.name} (not an image)`)
    } else if (file.size > maxSize) {
      invalidFiles.push(`${file.name} (exceeds 10MB)`)
    }
  }

  if (invalidFiles.length > 0) {
    alert(`Some files are invalid:\n${invalidFiles.join('\n')}`)
    target.value = ''
    return
  }

  // Start uploading all files
  isUploading.value = true
  uploadProgress.value = {
    current: 0,
    total: fileArray.length,
    currentFile: fileArray[0]?.name || ''
  }

  const successfulUploads: Item[] = []
  const failedUploads: { filename: string; error: string }[] = []

  // Upload files sequentially to avoid overwhelming the server
  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i]
    
    uploadProgress.value = {
      current: i + 1,
      total: fileArray.length,
      currentFile: file.name
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      console.log(`Uploading file ${i + 1}/${fileArray.length}: ${file.name}`)
      const response = await apiClient.post<{ auto_added: boolean; items: Item[] }>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      console.log('Upload response:', response.data)
      
      if (response.data.auto_added) {
        // Single item, automatically added
        successfulUploads.push(...response.data.items)
      } else {
        // Multiple items detected, need user confirmation
        const pending: PendingItem[] = response.data.items.map(item => ({
          ...item,
          selected: true // Default to selected
        }))
        pendingItems.value.push(...pending)
        showConfirmDialog.value = true
      }
    } catch (error: any) {
      console.error(`Upload failed for ${file.name}:`, error)
      const errorMessage = error?.response?.data?.detail || error?.message || 'Upload failed'
      failedUploads.push({ filename: file.name, error: errorMessage })
    }
  }

  // Add successful uploads to the list
  uploadedItems.value.push(...successfulUploads)

  // Show results
  if (successfulUploads.length > 0 && failedUploads.length === 0) {
    // All successful
    console.log(`Successfully uploaded ${successfulUploads.length} file(s)`)
  } else if (successfulUploads.length > 0 && failedUploads.length > 0) {
    // Partial success
    alert(`Uploaded ${successfulUploads.length} file(s) successfully.\n\nFailed:\n${failedUploads.map(f => `${f.filename}: ${f.error}`).join('\n')}`)
  } else if (failedUploads.length > 0) {
    // All failed
    alert(`All uploads failed:\n${failedUploads.map(f => `${f.filename}: ${f.error}`).join('\n')}`)
  }

  // Reset the input
  target.value = ''
  isUploading.value = false
  uploadProgress.value = null
}

const selectItem = (item: Item) => {
  if (selectedItem.value?.id === item.id) {
    selectedItem.value = null // Deselect
  } else {
    selectedItem.value = item
  }
  recommendations.value = [] // Reset recommendations
}

const getRecommendations = async () => {
  isGenerating.value = true
  recommendations.value = []
  
  try {
    const payload: { occasion: string; item_id?: string | number } = {
      occasion: occasion.value
    }
    
    if (selectedItem.value) {
      payload.item_id = selectedItem.value.id
    }

    const response = await apiClient.post<{ recommendations: Recommendation[] }>('/recommend', payload)
    recommendations.value = response.data.recommendations
  } catch (error) {
    console.error('Recommendation failed:', error)
    alert('Failed to get recommendations')
  } finally {
    isGenerating.value = false
  }
}

const confirmAddItems = async () => {
  const selectedItems = pendingItems.value.filter(item => item.selected)
  
  if (selectedItems.length === 0) {
    alert('Please select at least one item to add')
    return
  }

  try {
    const response = await apiClient.post<{ items: Item[] }>('/items/batch', selectedItems)
    uploadedItems.value.push(...response.data.items)
    console.log(`Added ${response.data.items.length} item(s) to wardrobe`)
    
    // Clear pending items and close dialog
    pendingItems.value = []
    showConfirmDialog.value = false
  } catch (error: any) {
    console.error('Failed to add items:', error)
    const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to add items'
    alert(`Failed to add items: ${errorMessage}`)
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

const logout = () => {
  localStorage.removeItem('auth_token')
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
    <header class="mb-8 flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Fashion AI Wardrobe</h1>
      <button @click="logout" class="text-sm text-gray-500 hover:text-black flex items-center gap-1">
        <LogOut class="w-4 h-4" />
        Sign Out
      </button>
    </header>

    <main class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Sidebar: Upload & Wardrobe -->
      <div class="lg:col-span-4 space-y-8">
        <!-- Upload -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload class="w-5 h-5" />
            Add Item
          </h2>
          <div 
            class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-black transition-colors cursor-pointer relative bg-gray-50 hover:bg-gray-100"
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
              <p class="font-medium text-gray-700">Click or drag to upload</p>
              <p class="text-xs text-gray-400 mt-2">Supports JPG, PNG (multiple files)</p>
            </div>
          </div>
        </div>

        <!-- Wardrobe Grid -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
          <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shirt class="w-5 h-5" />
            My Wardrobe
          </h2>
          <div class="grid grid-cols-2 gap-4">
            <div 
              v-for="item in uploadedItems" 
              :key="item.id" 
              @click="selectItem(item)"
              class="group relative rounded-xl overflow-hidden border aspect-[3/4] cursor-pointer transition-all hover:shadow-md"
              :class="selectedItem?.id === item.id ? 'border-black ring-2 ring-black ring-offset-2' : 'border-gray-200'"
            >
              <!-- Display Image from URL -->
              <img 
                v-if="item.url || item.features.path" 
                :src="item.url || item.features.path" 
                class="absolute inset-0 w-full h-full object-cover"
                alt="Clothing item"
              />
              <div v-else class="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400">
                <span class="text-xs">{{ item.features.type }}</span>
              </div>
              
              <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs translate-y-full group-hover:translate-y-0 transition-transform">
                {{ formatFeatureValue(item.features.color) }}
              </div>
            </div>
            
            <div v-if="uploadedItems.length === 0" class="col-span-full flex flex-col items-center justify-center text-gray-400 py-12">
              <Shirt class="w-12 h-12 mb-2 opacity-20" />
              <p class="text-sm">No items yet.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Analysis & Recommendations -->
      <div class="lg:col-span-8">
        <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-full">
          
          <!-- Header / Context -->
          <div class="mb-8">
            <h2 class="text-2xl font-bold mb-4">Outfit Generator</h2>
            
            <div class="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
               <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-600">Occasion:</span>
                  <select v-model="occasion" class="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black">
                    <option v-for="occ in occasions" :key="occ" :value="occ">{{ occ }}</option>
                  </select>
               </div>
               
               <div class="h-6 w-px bg-gray-200"></div>
               
               <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-600">Mode:</span>
                  <span v-if="selectedItem" class="text-sm bg-black text-white px-2 py-1 rounded">Match Item (Scheme A)</span>
                  <span v-else class="text-sm bg-blue-600 text-white px-2 py-1 rounded">Full Outfit (Scheme B)</span>
               </div>
            </div>
          </div>

          <!-- Selected Item Preview (if any) -->
          <div v-if="selectedItem" class="mb-8 p-4 border border-gray-100 rounded-xl flex items-center justify-between bg-gray-50/50">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs overflow-hidden">
                    <img 
                        v-if="selectedItem.url || selectedItem.features.path" 
                        :src="selectedItem.url || selectedItem.features.path" 
                        class="w-full h-full object-cover"
                    />
                    <span v-else>{{ selectedItem.features.type }}</span>
                </div>
                <div>
                    <p class="font-medium">Selected: {{ formatFeatureValue(selectedItem.features.color) }} {{ formatFeatureValue(selectedItem.features.type) }}</p>
                    <p class="text-xs text-gray-500">{{ formatFeatureValue(selectedItem.features.style) }}</p>
                </div>
            </div>
            <button @click="selectedItem = null" class="text-sm text-gray-400 hover:text-black underline">
              Clear Selection
            </button>
          </div>

          <!-- Actions -->
          <div class="flex gap-4 mb-8">
            <button 
              @click="getRecommendations" 
              :disabled="isGenerating"
              class="bg-black text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-lg shadow-black/20 w-full justify-center sm:w-auto"
            >
              <Wand2 class="w-5 h-5" />
              {{ isGenerating ? 'AI is Thinking...' : (selectedItem ? 'Find Matching Items' : 'Generate Full Outfit') }}
            </button>
          </div>

          <!-- Recommendations -->
          <div v-if="recommendations.length > 0">
            <h3 class="text-lg font-semibold mb-4">AI Suggestions</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div v-for="rec in recommendations" :key="rec.id" class="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow">
                <div class="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center text-gray-400 overflow-hidden">
                  <img 
                    v-if="rec.path && rec.path.startsWith('http')" 
                    :src="rec.path" 
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ rec.type }}</span>
                </div>
                <p class="font-medium text-sm">{{ rec.color }} {{ rec.type }}</p>
                <p class="text-xs text-gray-500 mt-1">{{ rec.reason }}</p>
                <p class="text-xs text-green-600 mt-1 font-medium">Match: {{ Math.round(rec.score * 100) }}%</p>
              </div>
            </div>
          </div>
          
          <!-- Empty State / Intro -->
          <div v-else-if="!isGenerating" class="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
             <Wand2 class="w-12 h-12 mx-auto mb-3 text-gray-300" />
             <p class="text-gray-500 font-medium">Ready to style!</p>
             <p class="text-sm text-gray-400 mt-1">Select an item to find matches, or deselect all to generate a full outfit.</p>
          </div>
          
          <!-- Loading State -->
          <div v-else class="py-12 flex flex-col items-center justify-center">
             <div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
             <p class="text-gray-500 animate-pulse">Consulting fashion knowledge base...</p>
          </div>
        </div>
      </div>
    </main>

    <!-- Confirmation Dialog for Multiple Items -->
    <div v-if="showConfirmDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="cancelAddItems">
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
            class="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Add Selected ({{ pendingItems.filter(i => i.selected).length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
