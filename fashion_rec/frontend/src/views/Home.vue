<script setup lang="ts">
import { ref } from 'vue'
import { Upload, Shirt, Wand2, LogOut } from 'lucide-vue-next'
import axios from 'axios'
import { useRouter } from 'vue-router'
import type { Item, Recommendation } from '../types'

const router = useRouter()
const API_URL = 'http://localhost:8000'

const uploadedItems = ref<Item[]>([])
const isUploading = ref(false)
const selectedItem = ref<Item | null>(null)
const recommendations = ref<Recommendation[]>([])
const isGenerating = ref(false)
const occasion = ref('Casual')
const occasions = ['Casual', 'Business', 'Party', 'Sport', 'Date']

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploading.value = true
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await axios.post<Item>(`${API_URL}/upload`, formData)
    uploadedItems.value.push(response.data)
  } catch (error) {
    console.error('Upload failed:', error)
    alert('Upload failed')
  } finally {
    isUploading.value = false
  }
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

    const response = await axios.post<{ recommendations: Recommendation[] }>(`${API_URL}/recommend`, payload)
    recommendations.value = response.data.recommendations
  } catch (error) {
    console.error('Recommendation failed:', error)
    alert('Failed to get recommendations')
  } finally {
    isGenerating.value = false
  }
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
          <div class="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-black transition-colors cursor-pointer relative bg-gray-50 hover:bg-gray-100">
            <input type="file" @change="handleFileUpload" class="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
            <div v-if="isUploading" class="flex flex-col items-center gap-2">
              <div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              <span class="text-sm text-gray-500">Analyzing...</span>
            </div>
            <div v-else>
              <p class="font-medium text-gray-700">Click or drag to upload</p>
              <p class="text-xs text-gray-400 mt-2">Supports JPG, PNG</p>
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
                {{ item.features.color }}
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
                    <p class="font-medium">Selected: {{ selectedItem.features.color }} {{ selectedItem.features.type }}</p>
                    <p class="text-xs text-gray-500">{{ selectedItem.features.style }}</p>
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
  </div>
</template>
