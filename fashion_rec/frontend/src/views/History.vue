<script setup lang="ts">
defineOptions({ name: 'History' })
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const looks = ref<any[]>([])
const isLoading = ref(false)
const error = ref('')

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

const loadLooks = async () => {
  isLoading.value = true
  error.value = ''
  try {
    const response = await apiClient.get<{ looks: any[] }>('/looks')
    looks.value = response.data.looks || []
  } catch (e: any) {
    console.error('Failed to load looks:', e)
    error.value = e?.response?.data?.detail || e?.message || 'Failed to load looks'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadLooks()
})

</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <header class="container mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">My Outfit History</h1>
    </header>

    <main class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div
        v-if="isLoading"
        class="py-12 flex flex-col items-center justify-center"
      >
        <div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-gray-500">Loading saved outfits...</p>
      </div>

      <div v-else-if="error" class="py-8 text-center text-red-600 text-sm">
        {{ error }}
      </div>

      <div v-else-if="!looks.length" class="py-12 text-center text-gray-500 text-sm">
        You haven't saved any outfits yet. Go generate some looks and save your favorites.
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="look in looks"
          :key="look.id"
          class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
        >
          <div class="flex justify-between items-center gap-2 mb-2">
            <h2 class="font-semibold text-sm truncate">{{ look.title }}</h2>
            <span class="text-xs text-gray-400">{{ look.occasion }}</span>
          </div>
          <p class="text-xs text-gray-500 mb-2">
            {{ look.weather_summary || 'Weather info not recorded.' }}
          </p>
          <p class="text-sm text-gray-800 whitespace-pre-line mb-2">
            {{ look.long_text }}
          </p>
          <p class="text-[11px] text-gray-400">
            Saved at: {{ look.created_at }}
          </p>
        </div>
      </div>
    </main>
  </div>
</template>


