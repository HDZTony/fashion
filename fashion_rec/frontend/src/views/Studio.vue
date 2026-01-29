<script setup lang="ts">
defineOptions({ name: 'Studio' })
import { ref, onMounted, onUnmounted, onActivated, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Wand2, X, Clock, Upload, Heart, Trash2, Shirt, Image, RotateCw, Check } from 'lucide-vue-next'
import ImageViewer from '@/components/ImageViewer.vue'
import type { Item, Recommendation, AgentOutfit } from '../types'
import { supabase } from '../lib/supabase'
import { apiClient, uploadApiClient, subscriptionClient } from '../lib/api-client'
import { useStudioStore } from '../stores/studio'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { getThumbnailUrl, getSmallImageUrl, getMediumImageUrl, getLargeImageUrl } from '../lib/imageOptimizer'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// Initialize Pinia store
const studioStore = useStudioStore()

// Uploaded wardrobe items (persisted via store)
const uploadedItems = computed({
  get: () => studioStore.uploadedItems,
  set: (value) => studioStore.setUploadedItems(value)
})
// Local state (not persisted)
const selectedItem = ref<Item | null>(null)
const selectedItemIds = computed({
  get: () => studioStore.selectedItemIds,
  set: (value) => studioStore.setSelectedItemIds(value)
})
const recommendations = ref<Recommendation[]>([])
const modelImageFile = ref<File | null>(null)
const isGenerating = ref(false)
const isTryingOn = ref(false)
// 应用穿搭：当前正在应用的卡片索引；应用成功后短暂展示“已应用”的卡片索引
const applyingOutfitIndex = ref<number | null>(null)
const appliedOutfitIndex = ref<number | null>(null)

// Background image file (not persisted, only URL is persisted)
const backgroundImageFile = ref<File | null>(null)

// Use store state (automatically persisted)
const customPrompt = computed({
  get: () => studioStore.customPrompt,
  set: (value) => studioStore.setCustomPrompt(value)
})
const backgroundImageUrl = computed({
  get: () => studioStore.backgroundImageUrl,
  set: (value) => studioStore.setBackgroundImage(value, value)
})
const backgroundImagePreviewUrl = computed({
  get: () => studioStore.backgroundImagePreviewUrl,
  set: (value) => studioStore.setBackgroundImage(studioStore.backgroundImageUrl, value)
})
const modelImagePreviewUrl = computed({
  get: () => studioStore.modelImagePreviewUrl,
  set: (value) => studioStore.setModelImage(value)
})
const tryOnImageUrl = computed({
  get: () => studioStore.tryOnImageUrl,
  set: (value) => studioStore.setTryOnImage(value)
})
const agentOutfits = computed({
  get: () => studioStore.agentOutfits,
  set: (value) => studioStore.setAgentOutfits(value)
})
const activeWardrobeIds = computed({
  get: () => studioStore.activeWardrobeIds,
  set: (value) => studioStore.setActiveWardrobeIds(value)
})
// Active wardrobe role map (computed from store entries)
const activeWardrobeRoleMap = computed({
  get: () => studioStore.getActiveWardrobeRoleMap(),
  set: (value) => studioStore.setActiveWardrobeRoleMap(value)
})

// Background action prompt (persisted via store)
const backgroundActionPrompt = computed({
  get: () => studioStore.backgroundActionPrompt,
  set: (value) => studioStore.setBackgroundActionPrompt(value)
})

// Helper functions to update role map (since computed doesn't support Map methods directly)
const updateRoleMap = (fn: (map: Map<string, string>) => void) => {
  const map = studioStore.getActiveWardrobeRoleMap()
  fn(map)
  studioStore.setActiveWardrobeRoleMap(map)
}

const originalAppliedOutfit = computed({
  get: () => studioStore.originalAppliedOutfit,
  set: (value) => studioStore.setOriginalAppliedOutfit(value)
})
const favoriteSaved = computed({
  get: () => studioStore.favoriteSaved,
  set: (value) => studioStore.setFavoriteStatus(value, studioStore.currentFavoriteId)
})
const currentFavoriteId = computed({
  get: () => studioStore.currentFavoriteId,
  set: (value) => studioStore.setFavoriteStatus(studioStore.favoriteSaved, value)
})

// Historical images
interface HistoricalImage {
  id: string
  image_url: string
  image_type: 'background' | 'model'
  created_at: string
}
const historicalBackgroundImages = ref<HistoricalImage[]>([])
const historicalModelImages = ref<HistoricalImage[]>([])
const showBackgroundImageHistory = ref(false)
const showModelImageHistory = ref(false)
const showExampleModelImages = ref(false)
const showExampleBackgroundImages = ref(false)

// Example model images (pre-uploaded sample photos)
const exampleModelImages = ref<string[]>([
  // These are placeholder URLs - replace with actual pre-uploaded image URLs
  // You can upload these images to your storage (R2) and use the public URLs here
  'https://r2.fashion-rec.com/example/IMG_9953.JPG',
  'https://r2.fashion-rec.com/example/IMG_9954.JPG',
])

// Example background images with prompts (pre-uploaded sample photos)
interface ExampleBackgroundImage {
  url: string
  prompt: string
}

const exampleBackgroundImages = ref<ExampleBackgroundImage[]>([
  { url: 'https://r2.fashion-rec.com/example/nature-wallpaper-7541423_1920.jpg', prompt: 'studio.exampleBackgroundPrompts.001' },
  { url: 'https://r2.fashion-rec.com/example/pexels-abdul-ahad-2158214293-35229355.jpg', prompt: 'studio.exampleBackgroundPrompts.002' },
  { url: 'https://r2.fashion-rec.com/example/pexels-adamowicz-adamsky-2149308693-30925021.jpg', prompt: 'studio.exampleBackgroundPrompts.003' },
  { url: 'https://r2.fashion-rec.com/example/pexels-adriannacalvo-23384610.jpg', prompt: 'studio.exampleBackgroundPrompts.004' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alecdoua-34864230.jpg', prompt: 'studio.exampleBackgroundPrompts.005' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alexandre-moreira-2527876-34593721.jpg', prompt: 'studio.exampleBackgroundPrompts.006' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alina-zahorulko-48514961-31445409.jpg', prompt: 'studio.exampleBackgroundPrompts.007' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alina-zahorulko-48514961-31445410.jpg', prompt: 'studio.exampleBackgroundPrompts.008' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alinaskazka-34702608.jpg', prompt: 'studio.exampleBackgroundPrompts.009' },
  { url: 'https://r2.fashion-rec.com/example/pexels-aljona-ovtsinnikova-121486965-24740438.jpg', prompt: 'studio.exampleBackgroundPrompts.010' },
  { url: 'https://r2.fashion-rec.com/example/pexels-alyona-nagel-1468385055-35224891.jpg', prompt: 'studio.exampleBackgroundPrompts.011' },
  { url: 'https://r2.fashion-rec.com/example/pexels-buxteh-30221622.jpg', prompt: 'studio.exampleBackgroundPrompts.012' },
  { url: 'https://r2.fashion-rec.com/example/pexels-casnafu-35129031.jpg', prompt: 'studio.exampleBackgroundPrompts.013' },
  { url: 'https://r2.fashion-rec.com/example/pexels-cheng-shi-song-427082720-33792335.jpg', prompt: 'studio.exampleBackgroundPrompts.014' },
  { url: 'https://r2.fashion-rec.com/example/pexels-christina99999-34801832.jpg', prompt: 'studio.exampleBackgroundPrompts.015' },
  { url: 'https://r2.fashion-rec.com/example/pexels-cigdem-bilgin-2154409770-35014795.jpg', prompt: 'studio.exampleBackgroundPrompts.016' },
  { url: 'https://r2.fashion-rec.com/example/pexels-dario-rawert-724203352-26765041.jpg', prompt: 'studio.exampleBackgroundPrompts.017' },
  { url: 'https://r2.fashion-rec.com/example/pexels-davidexpedition-31225636.jpg', prompt: 'studio.exampleBackgroundPrompts.018' },
  { url: 'https://r2.fashion-rec.com/example/pexels-dawidtkocz-34686175.jpg', prompt: 'studio.exampleBackgroundPrompts.019' },
  { url: 'https://r2.fashion-rec.com/example/pexels-diana-gp-358688833-14714743.jpg', prompt: 'studio.exampleBackgroundPrompts.020' },
  { url: 'https://r2.fashion-rec.com/example/pexels-diego-f-parra-33199-25254926.jpg', prompt: 'studio.exampleBackgroundPrompts.021' },
  { url: 'https://r2.fashion-rec.com/example/pexels-edgar-mosqueda-camacho-544076702-27204878.jpg', prompt: 'studio.exampleBackgroundPrompts.022' },
  { url: 'https://r2.fashion-rec.com/example/pexels-esrannuur-129682465-13820222.jpg', prompt: 'studio.exampleBackgroundPrompts.023' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ezgi-kaya-498261122-35188967.jpg', prompt: 'studio.exampleBackgroundPrompts.024' },
  { url: 'https://r2.fashion-rec.com/example/pexels-galina-kolonitskaia-485466282-35002554.jpg', prompt: 'studio.exampleBackgroundPrompts.025' },
  { url: 'https://r2.fashion-rec.com/example/pexels-holodna-34974763.jpg', prompt: 'studio.exampleBackgroundPrompts.026' },
  { url: 'https://r2.fashion-rec.com/example/pexels-jan-korgaard-2426390-34712722.jpg', prompt: 'studio.exampleBackgroundPrompts.027' },
  { url: 'https://r2.fashion-rec.com/example/pexels-jonathan-yakubu-337910510-28041981.jpg', prompt: 'studio.exampleBackgroundPrompts.028' },
  { url: 'https://r2.fashion-rec.com/example/pexels-laura-paredis-1047081-27041249.jpg', prompt: 'studio.exampleBackgroundPrompts.029' },
  { url: 'https://r2.fashion-rec.com/example/pexels-maksim-smirnov-27565989-32315717.jpg', prompt: 'studio.exampleBackgroundPrompts.030' },
  { url: 'https://r2.fashion-rec.com/example/pexels-maurits-bausenhart-1112663191-34865450.jpg', prompt: 'studio.exampleBackgroundPrompts.031' },
  { url: 'https://r2.fashion-rec.com/example/pexels-myfoodie-2551794.jpg', prompt: 'studio.exampleBackgroundPrompts.032' },
  { url: 'https://r2.fashion-rec.com/example/pexels-nilsr-28271725.jpg', prompt: 'studio.exampleBackgroundPrompts.033' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ramon-clemente-1097299-34314485.jpg', prompt: 'studio.exampleBackgroundPrompts.034' },
  { url: 'https://r2.fashion-rec.com/example/pexels-ricky-kwong-113005840-35360579.jpg', prompt: 'studio.exampleBackgroundPrompts.035' },
  { url: 'https://r2.fashion-rec.com/example/pexels-simon73-30560968.jpg', prompt: 'studio.exampleBackgroundPrompts.036' },
  { url: 'https://r2.fashion-rec.com/example/pexels-studio-lichtfang-2152913672-32488229.jpg', prompt: 'studio.exampleBackgroundPrompts.037' },
  { url: 'https://r2.fashion-rec.com/example/pexels-tatilimiz-villada-2156582649-35141528.jpg', prompt: 'studio.exampleBackgroundPrompts.038' },
  { url: 'https://r2.fashion-rec.com/example/pexels-tobias-schwenk-2158345167-35319435.jpg', prompt: 'studio.exampleBackgroundPrompts.039' },
  { url: 'https://r2.fashion-rec.com/example/pexels-took-a-snap-789265640-20751943.jpg', prompt: 'studio.exampleBackgroundPrompts.040' },
  { url: 'https://r2.fashion-rec.com/example/pexels-urtimud-89-76108288-35117015.jpg', prompt: 'studio.exampleBackgroundPrompts.041' },
  { url: 'https://r2.fashion-rec.com/example/pexels-vahestnatukewild-34774915.jpg', prompt: 'studio.exampleBackgroundPrompts.042' },
  { url: 'https://r2.fashion-rec.com/example/pexels-valentin_21-808934417-31148513.jpg', prompt: 'studio.exampleBackgroundPrompts.043' },
  { url: 'https://r2.fashion-rec.com/example/pexels-wael-belkahla-2158256982-35329797.jpg', prompt: 'studio.exampleBackgroundPrompts.044' },
])

// Upload progress
const backgroundImageUploadProgress = ref(0)
const isUploadingBackgroundImage = ref(false)

// Current tab value for background image options (persisted via store)
const backgroundTabValue = computed({
  get: () => studioStore.backgroundTabValue,
  set: (value) => studioStore.setBackgroundTabValue(value)
})

// Model image upload progress
const modelImageUploadProgress = ref(0)
const isUploadingModelImage = ref(false)

// Model image error state
const showModelImageError = ref(false)

// Subscription info
const subscriptionInfo = ref<any>(null)
const isLoadingSubscription = ref(false)

// Load subscription info
const loadSubscriptionInfo = async () => {
  isLoadingSubscription.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Please sign in first')
    }

    const response = await subscriptionClient.get('/userinfo', {
      params: { user_id: user.id },
    })
    subscriptionInfo.value = response.data
  } catch (error: any) {
    console.error('Failed to load subscription info:', error)
    // If no subscription, default to Free plan
    subscriptionInfo.value = {
      planName: 'Free',
      remainingTries: 0,
      totalTries: 1,
      period: 'daily',
    }
  } finally {
    isLoadingSubscription.value = false
  }
}

// Image viewer for applied outfit items
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])

// Persist items via Pinia (sessionStorage-backed)
const saveItemsToCache = () => {
  // Pinia persistence handles storage; setter ensures reactivity
  studioStore.setUploadedItems([...uploadedItems.value])
}

const restoreItemsFromCache = () => {
  // If store already has data (from persisted session), treat as restored
  return Array.isArray(uploadedItems.value) && uploadedItems.value.length > 0
}

// State is automatically persisted by Pinia store, no need for manual save/restore

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
    // Save to sessionStorage for faster loading next time
    saveItemsToCache()
    console.log('Loaded user items:', uploadedItems.value.length)
  } catch (error: any) {
    console.error('Failed to load user items:', error)
    // Don't show alert on initial load failure, just log it
  }
}

// Load historical images
const loadHistoricalImages = async () => {
  try {
    console.log('[loadHistoricalImages] Starting to load historical images...')
    const [backgroundResp, modelResp] = await Promise.all([
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=background'),
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=model'),
    ])
    console.log('[loadHistoricalImages] Background response:', backgroundResp.data)
    console.log('[loadHistoricalImages] Model response:', modelResp.data)
    
    // Ensure we handle both response formats: { images: [...] } or direct array
    const backgroundImages = backgroundResp.data?.images || backgroundResp.data || []
    const modelImages = modelResp.data?.images || modelResp.data || []
    
    historicalBackgroundImages.value = Array.isArray(backgroundImages) ? backgroundImages : []
    historicalModelImages.value = Array.isArray(modelImages) ? modelImages : []
    
    console.log('[loadHistoricalImages] Loaded background images:', historicalBackgroundImages.value.length)
    console.log('[loadHistoricalImages] Loaded model images:', historicalModelImages.value.length)
  } catch (error) {
    console.error('[loadHistoricalImages] Failed to load historical images:', error)
    // Keep existing values on error, don't reset to empty
    // This prevents button from disappearing if a subsequent request fails
  }
}

// Keyboard navigation (image viewer handles its own keys in ImageViewer.vue)

// Load items when component mounts
onMounted(async () => {
  // Check if this is a route navigation (from another page) or a page refresh (F5/Ctrl+R)
  // Route navigation sets a marker in router guard, page refresh doesn't
  const isRouteNavigation = sessionStorage.getItem('studio-route-navigation') === 'true'
  
  // Detect if this is a true page refresh (F5/Ctrl+R)
  let isPageRefresh = false
  if (!isRouteNavigation) {
    // Only check navigation type if it's not a route navigation
    try {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (navigationEntry) {
        // 'reload' means user pressed F5 or Ctrl+R
        // 'navigate' means normal navigation (including initial load)
        isPageRefresh = navigationEntry.type === 'reload'
      } else if (performance.navigation) {
        // Fallback for older browsers
        // 1 = TYPE_RELOAD (refresh), 0 = TYPE_NAVIGATE (normal navigation)
        isPageRefresh = (performance.navigation as any).type === 1
      }
    } catch (e) {
      console.warn('[onMounted] Failed to detect navigation type:', e)
    }
  }
  
  // Clear route navigation marker after checking
  if (isRouteNavigation) {
    sessionStorage.removeItem('studio-route-navigation')
    console.log('[onMounted] Route navigation detected (from another page), preserving studio state')
  } else if (isPageRefresh) {
    console.log('[onMounted] Page refresh detected (F5/Ctrl+R), clearing studio state')
    studioStore.clearState()
    // Also clear sessionStorage to ensure clean state
    sessionStorage.removeItem('studio-store')
    sessionStorage.removeItem('tryon_history_restore')
  } else {
    console.log('[onMounted] Initial page load, preserving studio state')
  }
  
  // Load local selection state first and sync to activeWardrobeIds
  // Skip if page refresh (user wants clean state)
  if (!isPageRefresh) {
    syncSelectedItemsToActiveWardrobe()

    // Try to restore items from cache first for instant display of Applied outfit items
    // These items are already loaded in Wardrobe page and saved to sessionStorage
    // Studio page doesn't need to load all items from backend - only items selected in Wardrobe are needed
    restoreItemsFromCache()
  }
  
  // Studio state is automatically restored by Pinia store (no manual restore needed)
  // But we need to check favorite status if try-on image exists
  const lookId = route.query.lookId as string | undefined
  const tryonHistoryId = route.query.tryonHistoryId as string | undefined
  
  // Skip favorite status check on page refresh (state is already cleared)
  if (!isPageRefresh && !lookId && !tryonHistoryId && tryOnImageUrl.value) {
    // If not restoring from history and try-on image exists, check favorite status
    checkFavoriteStatus()
  }
  
  // Wait for authentication to be ready before loading other data
  // Note: We don't load items from backend here because Applied outfit items only show
  // items selected from Wardrobe page, which are already in sessionStorage cache
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      // Authentication is ready, load other data (not items)
      await Promise.all([
        loadHistoricalImages(),
        loadSubscriptionInfo()
      ])
    } else {
      console.warn('No session found on mount, but still attempting to load data')
      await Promise.all([
        loadHistoricalImages(),
        loadSubscriptionInfo()
      ])
    }
  } catch (error) {
    console.error('Failed to check session on mount:', error)
    await Promise.all([
      loadHistoricalImages(),
      loadSubscriptionInfo()
    ])
  }
  
  // Check if we need to restore a look from history
  // Skip restoration if this is a page refresh (user wants clean state on refresh)
  if (lookId && !isPageRefresh) {
    console.log('[onMounted] Found lookId in query, restoring look:', lookId)
    // Items should be in cache from Wardrobe page, but if not, restoreLookFromHistory will handle it
    await restoreLookFromHistory(lookId)
  }
  
  // Check if we need to restore try-on history
  // Skip restoration if this is a page refresh (user wants clean state on refresh)
  if (tryonHistoryId && !isPageRefresh) {
    console.log('[onMounted] Found tryonHistoryId in query, restoring try-on history:', tryonHistoryId)
    await restoreTryOnHistory(tryonHistoryId)
  }
  
})

// Sync selectedItemIds from store to activeWardrobeIds when component is activated
// This ensures items selected from Wardrobe page appear in Applied Outfit Items
const syncSelectedItemsToActiveWardrobe = () => {
  const ids = selectedItemIds.value
  if (Array.isArray(ids) && ids.length > 0) {
    const newIds = ids.filter(id => !activeWardrobeIds.value.includes(String(id)))
    if (newIds.length > 0) {
      activeWardrobeIds.value.push(...newIds.map(id => String(id)))
      console.log('[syncSelectedItemsToActiveWardrobe] Added new items to activeWardrobeIds:', newIds)
    }
  }
}

onActivated(() => {
  // When component is activated (e.g., user returns from Wardrobe page),
  // sync selected items from localStorage to activeWardrobeIds
  syncSelectedItemsToActiveWardrobe()
  
  // Restore items from cache if memory is empty (keep-alive may have failed)
  // Applied outfit items only need items that are already in Wardrobe, so use cache only
  // If cache is empty, it means user hasn't selected items in Wardrobe yet - show empty state
  if (uploadedItems.value.length === 0) {
    const restored = restoreItemsFromCache()
    if (restored) {
      console.log('[Studio onActivated] Restored items from sessionStorage (from Wardrobe page)')
    } else {
      console.log('[Studio onActivated] No cached data - user hasn\'t selected items in Wardrobe yet')
      // Don't load from backend - Applied outfit items only show items selected from Wardrobe
    }
  } else {
    console.log('[Studio onActivated] Using cached data, items count:', uploadedItems.value.length)
  }
  
  // Studio state is automatically restored by Pinia store (no manual restore needed)
  // Check favorite status if try-on image exists
  if (tryOnImageUrl.value) {
    checkFavoriteStatus()
  }
})

// Restore try-on history to Studio
const restoreTryOnHistory = async (tryonHistoryId: string) => {
  try {
    console.log('[restoreTryOnHistory] Restoring try-on history:', tryonHistoryId)
    
    // Get restore data from sessionStorage
    const restoreDataStr = sessionStorage.getItem('tryon_history_restore')
    if (!restoreDataStr) {
      console.warn('[restoreTryOnHistory] No restore data found in sessionStorage')
      return
    }
    
    const restoreData = JSON.parse(restoreDataStr)
    
    // Verify the ID matches
    if (restoreData.tryonHistoryId !== tryonHistoryId) {
      console.warn('[restoreTryOnHistory] History ID mismatch')
      return
    }
    
    // Load historical images FIRST before restoring anything
    // This ensures we have model images available for matching
    console.log('[restoreTryOnHistory] Loading historical images...')
    await loadHistoricalImages()
    console.log('[restoreTryOnHistory] Historical images loaded:', {
      model: historicalModelImages.value.length,
      background: historicalBackgroundImages.value.length
    })
    
    // Load user items to match garment URLs with wardrobe items
    if (uploadedItems.value.length === 0) {
      const restored = restoreItemsFromCache()
      if (!restored) {
        console.log('[restoreTryOnHistory] Loading items from backend to match garment URLs...')
        await loadUserItems()
      }
    }
    
    // Restore prompt (backend already saves only user's original input)
    if (restoreData.prompt) {
      customPrompt.value = restoreData.prompt
      console.log('[restoreTryOnHistory] Restored prompt:', restoreData.prompt)
    }
    
    // Restore background image
    if (restoreData.background_image_url) {
      backgroundImageUrl.value = restoreData.background_image_url
      backgroundImagePreviewUrl.value = restoreData.background_image_url
      backgroundImageFile.value = null
      console.log('[restoreTryOnHistory] Restored background image:', restoreData.background_image_url)
    }
    
    // Restore try-on result image
    if (restoreData.image_url) {
      tryOnImageUrl.value = restoreData.image_url
      console.log('[restoreTryOnHistory] Restored try-on result image:', restoreData.image_url)
      // Check if this result is already in favorites
      await checkFavoriteStatus()
    }
    
    // Restore model image - prefer saved model_image_url/model_image_id, fallback to time-based matching
    if (restoreData.model_image_url) {
      // Use saved model image URL directly
      modelImagePreviewUrl.value = restoreData.model_image_url
      modelImageFile.value = null
      console.log('[restoreTryOnHistory] Restored model image from saved URL:', restoreData.model_image_url)
    } else if (restoreData.model_image_id) {
      // Find model image by ID
      const modelImage = historicalModelImages.value.find(img => img.id === restoreData.model_image_id)
      if (modelImage) {
        modelImagePreviewUrl.value = modelImage.image_url
        modelImageFile.value = null
        console.log('[restoreTryOnHistory] Restored model image by ID:', modelImage.image_url)
      } else {
        console.log('[restoreTryOnHistory] Model image ID not found in history, trying time-based match...')
        // Fallback to time-based matching
        const tryOnDate = new Date(restoreData.created_at)
        const modelImage = historicalModelImages.value
          .filter(img => {
            const imgDate = new Date(img.created_at)
            const timeDiff = tryOnDate.getTime() - imgDate.getTime()
            return timeDiff >= 0 && timeDiff <= 24 * 60 * 60 * 1000
          })
          .sort((a, b) => {
            const aDiff = tryOnDate.getTime() - new Date(a.created_at).getTime()
            const bDiff = tryOnDate.getTime() - new Date(b.created_at).getTime()
            return aDiff - bDiff
          })[0]
        
        if (modelImage) {
          modelImagePreviewUrl.value = modelImage.image_url
          modelImageFile.value = null
          console.log('[restoreTryOnHistory] Restored model image by time match:', modelImage.image_url)
        }
      }
    } else {
      // Fallback to time-based matching if no saved model image info
      const tryOnDate = new Date(restoreData.created_at)
      console.log('[restoreTryOnHistory] Try-on date:', tryOnDate.toISOString())
      console.log('[restoreTryOnHistory] Available model images:', historicalModelImages.value.length)
      
      const modelImage = historicalModelImages.value
        .filter(img => {
          const imgDate = new Date(img.created_at)
          const timeDiff = tryOnDate.getTime() - imgDate.getTime()
          return timeDiff >= 0 && timeDiff <= 24 * 60 * 60 * 1000
        })
        .sort((a, b) => {
          const aDiff = tryOnDate.getTime() - new Date(a.created_at).getTime()
          const bDiff = tryOnDate.getTime() - new Date(b.created_at).getTime()
          return aDiff - bDiff
        })[0]
      
      if (modelImage) {
        modelImagePreviewUrl.value = modelImage.image_url
        modelImageFile.value = null
        console.log('[restoreTryOnHistory] Restored model image by time match:', modelImage.image_url)
      } else if (historicalModelImages.value.length > 0) {
        const mostRecent = historicalModelImages.value
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        modelImagePreviewUrl.value = mostRecent.image_url
        modelImageFile.value = null
        console.log('[restoreTryOnHistory] Using most recent model image as fallback:', mostRecent.image_url)
      } else {
        console.log('[restoreTryOnHistory] No model images available in history')
      }
    }
    
    // Restore active wardrobe items by matching garment URLs
    if (restoreData.garment_urls && Array.isArray(restoreData.garment_urls) && restoreData.garment_urls.length > 0) {
      const matchedIds: string[] = []
      
      // Match garment URLs with wardrobe items
      restoreData.garment_urls.forEach((garmentUrl: string) => {
        const matchedItem = uploadedItems.value.find(item => {
          const itemUrl = item.url || item.features.path
          return itemUrl && (itemUrl === garmentUrl || itemUrl.includes(garmentUrl) || garmentUrl.includes(itemUrl))
        })
        
        if (matchedItem && matchedItem.id) {
          const id = String(matchedItem.id)
          if (!matchedIds.includes(id)) {
            matchedIds.push(id)
          }
        }
      })
      
      if (matchedIds.length > 0) {
        activeWardrobeIds.value = matchedIds
        console.log('[restoreTryOnHistory] Restored wardrobe items:', matchedIds)
      } else {
        console.warn('[restoreTryOnHistory] Could not match garment URLs with wardrobe items')
      }
    }
    
    // Clear restore data and query parameter
    sessionStorage.removeItem('tryon_history_restore')
    const query = { ...route.query }
    delete query.tryonHistoryId
    router.replace({ query })
    
    console.log('[restoreTryOnHistory] Successfully restored try-on history:', {
      prompt: customPrompt.value,
      backgroundImageUrl: backgroundImageUrl.value,
      tryOnImageUrl: tryOnImageUrl.value,
      activeWardrobeIds: activeWardrobeIds.value,
    })
  } catch (error: any) {
    console.error('[restoreTryOnHistory] Failed to restore try-on history:', error)
    // Clear restore data on error
    sessionStorage.removeItem('tryon_history_restore')
    const query = { ...route.query }
    delete query.tryonHistoryId
    router.replace({ query })
  }
}

// Restore look from history
const restoreLookFromHistory = async (lookId: string) => {
  try {
    console.log('[restoreLookFromHistory] Restoring look:', lookId)
    
    // Try to restore items from cache first (items are already loaded in Wardrobe page)
    if (uploadedItems.value.length === 0) {
      const restored = restoreItemsFromCache()
      if (!restored) {
        // If cache is empty, we need to load items to verify they exist
        // This is a special case for restoring historical looks
        console.log('[restoreLookFromHistory] No cached data, loading items from backend to restore look...')
        await loadUserItems()
      } else {
        console.log('[restoreLookFromHistory] Restored items from cache')
      }
    }
    
    // Fetch the look data
    const response = await apiClient.get(`/looks/${lookId}`)
    const look = response.data
    
    console.log('[restoreLookFromHistory] Look data:', look)
    
    // Restore prompt
    if (look.prompt) {
      customPrompt.value = look.prompt
    }
    
    // Restore background image
    if (look.background_image_url) {
      backgroundImageUrl.value = look.background_image_url
      backgroundImagePreviewUrl.value = look.background_image_url
      backgroundImageFile.value = null // Clear file since we're using URL
    }
    
    // Restore active wardrobe items
    if (look.items && Array.isArray(look.items)) {
      const validWardrobeIds = look.items
        .map((item: any) => item.wardrobe_id)
        .filter((id: any): id is string => !!id && typeof id === 'string')
      
      // Only restore items that exist in uploadedItems
      const existingIds = validWardrobeIds.filter((id: string) => 
        uploadedItems.value.some(item => String(item.id) === id)
      )
      
      activeWardrobeIds.value = existingIds
      
      // Restore role mapping
      updateRoleMap((map) => {
        map.clear()
        look.items.forEach((item: any) => {
          if (item.wardrobe_id && existingIds.includes(String(item.wardrobe_id))) {
            map.set(String(item.wardrobe_id), item.role)
          }
        })
      })
      
      // Restore original applied outfit for tracking missing roles
      originalAppliedOutfit.value = {
        title: look.title || '',
        items: look.items.map((item: any) => ({
          wardrobe_id: item.wardrobe_id || undefined,
          role: item.role,
          description: item.description || '',
        })),
        reason: look.reason || '',
        long_text: look.long_text || '',
      }
      
      console.log('[restoreLookFromHistory] Restored:', {
        wardrobeIds: activeWardrobeIds.value,
        roleMap: Array.from(activeWardrobeRoleMap.value.entries()),
        prompt: customPrompt.value,
        backgroundImageUrl: backgroundImageUrl.value,
      })
    }
    
    // Clear the lookId from URL to avoid restoring again on refresh
    const query = { ...route.query }
    delete query.lookId
    router.replace({ query })
  } catch (error: any) {
    console.error('[restoreLookFromHistory] Failed to restore look:', error)
    alert(`Failed to restore look: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
    // Clear the lookId from URL even on error
    const query = { ...route.query }
    delete query.lookId
    router.replace({ query })
  }
}

onUnmounted(() => {
  // State is automatically persisted by Pinia store
})

// Upload and direct selection are handled on the Wardrobe page now.

const getRecommendations = async () => {
  isGenerating.value = true
  recommendations.value = []
  agentOutfits.value = []
  tryOnImageUrl.value = null

  try {
    // Background image should already be uploaded in handleBackgroundImageChange
    // If we have a file but no URL, upload it now (fallback)
    if (backgroundImageFile.value && !backgroundImageUrl.value) {
      const formData = new FormData()
      formData.append('file', backgroundImageFile.value)

      try {
        const resp = await uploadApiClient.post<{ url: string }>('/background-image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        backgroundImageUrl.value = resp.data.url
        await loadHistoricalImages()
      } catch (e: any) {
        console.error('Background image upload failed:', e)
        alert(`Background image upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
      }
    }

    // Get currently active items as base (for supplementing deleted items)
    // Priority: activeWardrobeIds > selectedBaseItems
    let activeItemIds: string[] | undefined = undefined
    if (activeWardrobeIds.value.length > 0) {
      // If activeWardrobeIds has values, use them directly (no need to load uploadedItems)
      activeItemIds = activeWardrobeIds.value
    } else {
      // Only load uploadedItems if we need selectedBaseItems (when activeWardrobeIds is empty)
      if (uploadedItems.value.length === 0) {
        const restored = restoreItemsFromCache()
        if (!restored) {
          await loadUserItems()
        }
      }
      const hasBaseSelection = selectedBaseItems.value.length > 0
      if (hasBaseSelection) {
        activeItemIds = selectedBaseItems.value
          .map((it) => it.id)
          .filter((id): id is string | number => id !== undefined)
          .map(id => String(id))
      }
    }

    // Build prompt with information about missing roles (if any)
    let enhancedPrompt = customPrompt.value
    const missingRoles = getMissingRoles()
    if (missingRoles.length > 0) {
      const roleNames: Record<string, string> = {
        top: 'top',
        bottom: 'bottom',
        shoes: 'shoes',
        outer: 'outerwear',
        accessory: 'accessory'
      }
      const missingRoleNames = missingRoles.map(r => roleNames[r] || r).join(', ')
      enhancedPrompt = `${customPrompt.value}\n\nPlease add the missing items: ${missingRoleNames}.`
    }

    // Build selected_items_roles map from activeWardrobeRoleMap
    // Only include items that are currently in activeWardrobeIds (filter out deleted items)
    const selectedItemsRoles: Record<string, string> | undefined = 
      activeWardrobeIds.value.length > 0
        ? Object.fromEntries(
            Array.from(activeWardrobeRoleMap.value.entries())
              .filter(([id]) => activeWardrobeIds.value.includes(String(id)))
              .map(([id, role]) => [String(id), role])
          )
        : undefined

    const requestPayload = {
      base_item_ids: activeItemIds,
      prompt: enhancedPrompt,
      background_image_url: backgroundImageUrl.value || undefined,
      background_action_prompt: backgroundImageUrl.value && backgroundActionPrompt.value ? backgroundActionPrompt.value : undefined,
      model_image_url: modelImagePreviewUrl.value || undefined,
      selected_items_roles: selectedItemsRoles,
    }
    
    console.log('=== Generate Outfit Request (to qwen-vl) ===')
    console.log('Request payload:', JSON.stringify(requestPayload, null, 2))
    console.log('Missing roles to supplement:', missingRoles)
    console.log('Selected items roles:', selectedItemsRoles)
    console.log('==========================================')
    
    // Use uploadApiClient for outfit generation as it requires LLM processing (may take several minutes)
    const response = await uploadApiClient.post<{
      mode: 'agent'
      weather_summary: string
      wardrobe_count: number
      outfits: AgentOutfit[]
      raw_text: string
    }>('/outfit', requestPayload)

    console.log('Agent raw outfit text:', response.data.raw_text)
    agentOutfits.value = response.data.outfits || []
    // State is automatically persisted by Pinia store
  } catch (error: any) {
    console.error('Recommendation failed:', error)
    alert('Failed to get recommendations')
  } finally {
    isGenerating.value = false
  }
}

const formatFeatureValue = (value: string | string[] | undefined): string => {
  if (!value) return 'Unknown'
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value
}

// Category helpers are currently unused on Studio; kept for potential future UI.

const findWardrobeItemById = (wardrobeId?: string | null): Item | null => {
  if (!wardrobeId) return null
  return uploadedItems.value.find((it) => String(it.id) === String(wardrobeId)) || null
}

const activeWardrobeItems = computed(() =>
  activeWardrobeIds.value
    .map((id) => uploadedItems.value.find((it) => String(it.id) === id) || null)
    .filter((it): it is Item => it !== null),
)

// State is automatically persisted by Pinia store, no need for watch

const selectedBaseItems = computed(() =>
  selectedItemIds.value
    .map((id) => uploadedItems.value.find((it) => String(it.id) === id) || null)
    .filter((it): it is Item => it !== null),
)

const handleModelImageChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] || null
  if (!file) return

  modelImageFile.value = file
  showModelImageError.value = false // Reset error state when user uploads image
  isUploadingModelImage.value = true
  modelImageUploadProgress.value = 0

  // Upload to backend and save to history
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    // Fallback progress simulation (in case onUploadProgress doesn't fire)
    let hasRealProgress = false
    const progressInterval = setInterval(() => {
      if (!hasRealProgress && modelImageUploadProgress.value < 90) {
        modelImageUploadProgress.value += 10
      }
    }, 200)
    
    const resp = await uploadApiClient.post<{ url: string }>('/model-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        hasRealProgress = true
        if (progressEvent.total) {
          modelImageUploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        } else if (progressEvent.loaded) {
          // Estimate progress if total is unknown
          modelImageUploadProgress.value = Math.min(90, Math.round((progressEvent.loaded / file.size) * 100))
        }
      },
    })
    
    clearInterval(progressInterval)
    modelImageUploadProgress.value = 100
    
    // Save the server-returned URL and clear the file
    // This ensures that when calling /try-on, we use the URL instead of the file
    // which allows the backend to save model_image_url to history
    if (modelImagePreviewUrl.value) {
      URL.revokeObjectURL(modelImagePreviewUrl.value)
    }
    modelImagePreviewUrl.value = resp.data.url
    modelImageFile.value = null  // Clear file so /try-on uses URL instead
    
    // Reload historical images
    await loadHistoricalImages()
    
    // Reset progress after a short delay
    setTimeout(() => {
      isUploadingModelImage.value = false
      modelImageUploadProgress.value = 0
    }, 500)
  } catch (e: any) {
    console.error('Model image upload failed:', e)
    isUploadingModelImage.value = false
    modelImageUploadProgress.value = 0
    alert(`Model image upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
    return
  }

  showModelImageHistory.value = false
}

const selectHistoricalModelImage = (image: HistoricalImage) => {
  modelImageFile.value = null
  showModelImageError.value = false // Reset error state when user selects historical image
  if (modelImagePreviewUrl.value) {
    URL.revokeObjectURL(modelImagePreviewUrl.value)
  }
  modelImagePreviewUrl.value = image.image_url
  showModelImageHistory.value = false
}

const selectExampleModelImage = async (imageUrl: string) => {
  modelImageFile.value = null
  showModelImageError.value = false // Reset error state when user selects example image
  
  // Close the dialog immediately when clicking on an image
  showExampleModelImages.value = false
  
  // If the example image is already on our server (R2), use it directly
  // Otherwise, we need to upload it to save to history
  if (imageUrl.startsWith('http') && (imageUrl.includes('r2.dev') || imageUrl.includes('cloudflare'))) {
    // Already on our server, use directly (similar to historical images)
    if (modelImagePreviewUrl.value) {
      URL.revokeObjectURL(modelImagePreviewUrl.value)
    }
    modelImagePreviewUrl.value = imageUrl
    return
  }
  
  // For external URLs or local files, upload to backend to save to history
  try {
    // Fetch the image as a blob
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch example image')
    }
    const blob = await response.blob()
    const file = new File([blob], 'example-model.jpg', { type: blob.type })
    
    // Upload to backend to save to history
    const formData = new FormData()
    formData.append('file', file)
    
    isUploadingModelImage.value = true
    modelImageUploadProgress.value = 0
    
    let hasRealProgress = false
    const progressInterval = setInterval(() => {
      if (!hasRealProgress && modelImageUploadProgress.value < 90) {
        modelImageUploadProgress.value += 10
      }
    }, 200)
    
    const resp = await uploadApiClient.post<{ url: string }>('/model-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        hasRealProgress = true
        if (progressEvent.total) {
          modelImageUploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        } else if (progressEvent.loaded) {
          modelImageUploadProgress.value = Math.min(90, Math.round((progressEvent.loaded / blob.size) * 100))
        }
      },
    })
    
    clearInterval(progressInterval)
    modelImageUploadProgress.value = 100
    
    if (modelImagePreviewUrl.value) {
      URL.revokeObjectURL(modelImagePreviewUrl.value)
      modelImagePreviewUrl.value = null
    }
    modelImagePreviewUrl.value = resp.data.url
    modelImageFile.value = null
    
    // Reload historical images
    await loadHistoricalImages()
    
    // Reset progress
    setTimeout(() => {
      isUploadingModelImage.value = false
      modelImageUploadProgress.value = 0
    }, 500)
  } catch (e: any) {
    console.error('Failed to use example model image:', e)
    // Fallback: use the URL directly without uploading
    if (modelImagePreviewUrl.value) {
      URL.revokeObjectURL(modelImagePreviewUrl.value)
    }
    modelImagePreviewUrl.value = imageUrl
    isUploadingModelImage.value = false
    modelImageUploadProgress.value = 0
  }
}

const deleteHistoricalModelImage = async (image: HistoricalImage, event: Event) => {
  event.stopPropagation() // Prevent selecting the image when clicking delete
  
  if (!confirm('Delete this model image? This action cannot be undone.')) {
    return
  }
  
  try {
    await apiClient.delete(`/user-images/${image.id}`)
    // Remove from local state
    historicalModelImages.value = historicalModelImages.value.filter(img => img.id !== image.id)
    
    // If the deleted image was currently selected, clear the selection
    if (modelImagePreviewUrl.value === image.image_url) {
      if (modelImagePreviewUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(modelImagePreviewUrl.value)
      }
      modelImagePreviewUrl.value = null
    }
  } catch (error: any) {
    console.error('Failed to delete model image:', error)
    alert(`Delete failed: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
  }
}

const removeModelImage = () => {
  if (modelImagePreviewUrl.value) {
    URL.revokeObjectURL(modelImagePreviewUrl.value)
    modelImagePreviewUrl.value = null
  }
  modelImageFile.value = null
}

const handleBackgroundImageChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] || null
  if (!file) return

  backgroundImageFile.value = file
  backgroundImageUrl.value = null
  isUploadingBackgroundImage.value = true
  backgroundImageUploadProgress.value = 0

  // Upload to backend and save to history
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    // Fallback progress simulation (in case onUploadProgress doesn't fire)
    let hasRealProgress = false
    const progressInterval = setInterval(() => {
      if (!hasRealProgress && backgroundImageUploadProgress.value < 90) {
        backgroundImageUploadProgress.value += 10
      }
    }, 200)
    
    const resp = await uploadApiClient.post<{ url: string }>('/background-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        hasRealProgress = true
        if (progressEvent.total) {
          backgroundImageUploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        } else if (progressEvent.loaded) {
          // Estimate progress if total is unknown
          backgroundImageUploadProgress.value = Math.min(90, Math.round((progressEvent.loaded / file.size) * 100))
        }
      },
    })
    
    clearInterval(progressInterval)
    backgroundImageUploadProgress.value = 100
    backgroundImageUrl.value = resp.data.url
    
    // Reload historical images
    await loadHistoricalImages()
    
    // Reset progress after a short delay
    setTimeout(() => {
      isUploadingBackgroundImage.value = false
      backgroundImageUploadProgress.value = 0
    }, 500)
  } catch (e: any) {
    console.error('Background image upload failed:', e)
    isUploadingBackgroundImage.value = false
    backgroundImageUploadProgress.value = 0
    alert(`Background image upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
    return
  }

  if (backgroundImagePreviewUrl.value) {
    URL.revokeObjectURL(backgroundImagePreviewUrl.value)
    backgroundImagePreviewUrl.value = null
  }
  if (file) {
    backgroundImagePreviewUrl.value = URL.createObjectURL(file)
  }
  showBackgroundImageHistory.value = false
}

const selectHistoricalBackgroundImage = (image: HistoricalImage) => {
  backgroundImageUrl.value = image.image_url
  backgroundImageFile.value = null
  if (backgroundImagePreviewUrl.value) {
    URL.revokeObjectURL(backgroundImagePreviewUrl.value)
  }
  backgroundImagePreviewUrl.value = image.image_url
  showBackgroundImageHistory.value = false
}

const selectExampleBackgroundImage = async (image: ExampleBackgroundImage | string) => {
  backgroundImageFile.value = null
  
  // Handle both object format (with prompt) and legacy string format
  const imageUrl = typeof image === 'string' ? image : image.url
  const imagePromptKey = typeof image === 'string' ? '' : image.prompt
  
  // Fill in the background action prompt if available (translate if it's an i18n key)
  if (imagePromptKey) {
    // Check if it's an i18n key (starts with 'studio.')
    if (imagePromptKey.startsWith('studio.')) {
      backgroundActionPrompt.value = t(imagePromptKey)
    } else {
      // Legacy format: direct text
      backgroundActionPrompt.value = imagePromptKey
    }
  }
  
  // Close the dialog immediately when clicking on an image
  showExampleBackgroundImages.value = false
  
  // If the example image is already on our server (R2), use it directly
  // Otherwise, we need to upload it to save to history
  if (imageUrl.startsWith('http') && (imageUrl.includes('r2.dev') || imageUrl.includes('cloudflare'))) {
    // Already on our server, use directly (similar to historical images)
    backgroundImageUrl.value = imageUrl
    if (backgroundImagePreviewUrl.value) {
      URL.revokeObjectURL(backgroundImagePreviewUrl.value)
    }
    backgroundImagePreviewUrl.value = imageUrl
    return
  }
  
  // For external URLs or local files, upload to backend to save to history
  try {
    // Fetch the image as a blob
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error('Failed to fetch example image')
    }
    const blob = await response.blob()
    const file = new File([blob], 'example-background.jpg', { type: blob.type })
    
    // Upload to backend to save to history
    const formData = new FormData()
    formData.append('file', file)
    
    backgroundImageUrl.value = null
    isUploadingBackgroundImage.value = true
    backgroundImageUploadProgress.value = 0
    
    let hasRealProgress = false
    const progressInterval = setInterval(() => {
      if (!hasRealProgress && backgroundImageUploadProgress.value < 90) {
        backgroundImageUploadProgress.value += 10
      }
    }, 200)
    
    const resp = await uploadApiClient.post<{ url: string }>('/background-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        hasRealProgress = true
        if (progressEvent.total) {
          backgroundImageUploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        } else if (progressEvent.loaded) {
          backgroundImageUploadProgress.value = Math.min(90, Math.round((progressEvent.loaded / blob.size) * 100))
        }
      },
    })
    
    clearInterval(progressInterval)
    backgroundImageUploadProgress.value = 100
    backgroundImageUrl.value = resp.data.url
    
    // Reload historical images
    await loadHistoricalImages()
    
    if (backgroundImagePreviewUrl.value) {
      URL.revokeObjectURL(backgroundImagePreviewUrl.value)
      backgroundImagePreviewUrl.value = null
    }
    backgroundImagePreviewUrl.value = resp.data.url
    
    // Reset progress
    setTimeout(() => {
      isUploadingBackgroundImage.value = false
      backgroundImageUploadProgress.value = 0
    }, 500)
  } catch (e: any) {
    console.error('Failed to use example background image:', e)
    // Fallback: use the URL directly without uploading
    backgroundImageUrl.value = imageUrl
    if (backgroundImagePreviewUrl.value) {
      URL.revokeObjectURL(backgroundImagePreviewUrl.value)
    }
    backgroundImagePreviewUrl.value = imageUrl
    isUploadingBackgroundImage.value = false
    backgroundImageUploadProgress.value = 0
    alert(`Failed to upload example image: ${e?.message || 'Unknown error'}. Using image directly.`)
  }
}

const deleteHistoricalBackgroundImage = async (image: HistoricalImage, event: Event) => {
  event.stopPropagation() // Prevent selecting the image when clicking delete
  
  if (!confirm('Delete this background image? This action cannot be undone.')) {
    return
  }
  
  try {
    await apiClient.delete(`/user-images/${image.id}`)
    // Remove from local state
    historicalBackgroundImages.value = historicalBackgroundImages.value.filter(img => img.id !== image.id)
    
    // If the deleted image was currently selected, clear the selection
    if (backgroundImageUrl.value === image.image_url) {
      backgroundImageUrl.value = null
      if (backgroundImagePreviewUrl.value === image.image_url) {
        if (backgroundImagePreviewUrl.value.startsWith('blob:')) {
          URL.revokeObjectURL(backgroundImagePreviewUrl.value)
        }
        backgroundImagePreviewUrl.value = null
      }
    }
  } catch (error: any) {
    console.error('Failed to delete background image:', error)
    alert(`Delete failed: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
  }
}

const removeBackgroundImage = () => {
  if (backgroundImagePreviewUrl.value) {
    URL.revokeObjectURL(backgroundImagePreviewUrl.value)
    backgroundImagePreviewUrl.value = null
  }
  backgroundImageFile.value = null
  backgroundImageUrl.value = null
}

const performTryOn = async () => {
  // 确保背景图片（如果有）已经上传获得 URL
  if (backgroundImageFile.value && !backgroundImageUrl.value) {
    try {
      const form = new FormData()
      form.append('file', backgroundImageFile.value)
      const resp = await uploadApiClient.post<{ url: string }>('/background-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      backgroundImageUrl.value = resp.data.url
    } catch (e: any) {
      console.error('Background image upload failed before try-on:', e)
      alert(`Background image upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
      return
    }
  }

  if (!modelImageFile.value && !modelImagePreviewUrl.value) {
    showModelImageError.value = true
    alert(t('studio.modelPhoto.pleaseUploadFirst'))
    // Scroll to model image uploader
    setTimeout(() => {
      const modelUploader = document.querySelector('[data-model-uploader]')
      if (modelUploader) {
        modelUploader.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
    return
  }

  const garmentUrls = activeWardrobeItems.value
    .map((item) => item.url || item.features.path)
    .filter((u): u is string => !!u)

  const unmatched_descriptions = unmatchedOutfitDescriptions.value

  const hasGarments = garmentUrls.length > 0
  const hasUnmatchedText = unmatched_descriptions.length > 0
  if (!hasGarments && !hasUnmatchedText) {
    alert(t('studio.outfitPlans.pleaseChooseOutfit'))
    return
  }
  if (activeWardrobeItems.value.length > 0 && garmentUrls.length === 0 && !hasUnmatchedText) {
    alert(t('studio.outfitPlans.missingImageUrls'))
    return
  }

  tryOnImageUrl.value = null
  isTryingOn.value = true
  // Reset favorite state when starting a new try-on
  studioStore.setFavoriteStatus(false, null)

  const tryOnRequestData = {
    person_image: modelImageFile.value?.name || 'file',
    garment_urls: garmentUrls,
    background_image_url: backgroundImageUrl.value || undefined,
  }
  
  console.log('=== Try-On Request (to qwen-image-edit) ===')
  console.log('Request data:', JSON.stringify(tryOnRequestData, null, 2))
  console.log('Garment URLs:', garmentUrls)
  console.log('Background image URL:', backgroundImageUrl.value || 'None')
  console.log('==========================================')

  try {
    const formData = new FormData()
    // Use modelImageFile if available, otherwise use modelImagePreviewUrl (from historical images)
    if (modelImageFile.value) {
      formData.append('person_image', modelImageFile.value)
    } else if (modelImagePreviewUrl.value) {
      // If it's a URL (e.g., from history), send it directly to backend to avoid CORS issues
      formData.append('person_image_url', modelImagePreviewUrl.value)
    }
    formData.append('garment_urls', JSON.stringify(garmentUrls))
    if (unmatched_descriptions.length > 0) {
      formData.append('unmatched_descriptions', JSON.stringify(unmatched_descriptions))
    }
    if (backgroundImageUrl.value) {
      formData.append('background_image_url', backgroundImageUrl.value)
    }
    // Add background action prompt (model action description) if provided
    if (backgroundActionPrompt.value) {
      formData.append('background_action_prompt', backgroundActionPrompt.value)
    }
    // Add custom prompt if provided
    if (customPrompt.value) {
      formData.append('prompt', customPrompt.value)
    }

    const response = await uploadApiClient.post<{ url: string }>('/try-on', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    tryOnImageUrl.value = response.data.url
    // Reset favorite status when generating new try-on result
    studioStore.setFavoriteStatus(false, null)
    // State is automatically persisted by Pinia store
  } catch (error: any) {
    console.error('Try-on failed:', error)
    
    // Extract error message from response
    let errorMessage = 'Failed to generate try-on result. Please try again later.'
    
    // Check if it's a 403 error (subscription limit reached)
    if (error.response?.status === 403) {
      // Try to get detailed error message from response
      const detail = error.response?.data?.detail || error.response?.data?.error
      if (detail) {
        errorMessage = detail
      } else {
        errorMessage = 'Your try-on limit has been reached. Please wait for the next reset period or upgrade your plan.'
      }
    } else if (error.response?.data?.detail) {
      // For other errors, try to get detail message
      errorMessage = error.response.data.detail
    } else if (error.response?.data?.error) {
      // Fallback to error field
      errorMessage = error.response.data.error
    } else if (error.message) {
      // Use error message if available
      errorMessage = error.message
    }
    
    alert(errorMessage)
  } finally {
    isTryingOn.value = false
  }
}


const applyOutfit = async (outfit: AgentOutfit, cardIndex?: number) => {
  if (cardIndex !== undefined) {
    applyingOutfitIndex.value = cardIndex
    appliedOutfitIndex.value = null
  }
  try {
    // Ensure uploadedItems is loaded before applying outfit
    // Try to restore from cache first (items are already loaded in Wardrobe page)
    if (uploadedItems.value.length === 0) {
      const restored = restoreItemsFromCache()
      if (!restored) {
        // If cache is empty, try to load all items from backend
        // This allows users to apply outfits even if they haven't selected items in Wardrobe first
        console.warn('[Apply Outfit] No cached data - loading items from backend...')
        await loadUserItems()
        if (uploadedItems.value.length === 0) {
          alert('No items found in your wardrobe. Please add items to your wardrobe first.')
          return
        }
        console.log('[Apply Outfit] Loaded items from backend:', uploadedItems.value.length)
      } else {
        console.log('[Apply Outfit] Restored items from cache')
      }
    }
    
    console.log('[Apply Outfit] Starting...')
    console.log('[Apply Outfit] Outfit items:', outfit.items)
    console.log('[Apply Outfit] Available uploadedItems:', uploadedItems.value.length)
    
  // Get all currently selected items (from activeWardrobeItems or selectedBaseItems)
  const currentSelectedIds = new Set<string>()
  const currentSelectedRoles = new Set<string>()
  
  // Add active wardrobe items (already applied items)
  activeWardrobeIds.value.forEach(id => {
    currentSelectedIds.add(String(id))
    const role = activeWardrobeRoleMap.value.get(String(id))
    if (role) {
      currentSelectedRoles.add(role)
    }
  })
  
  // Add selected base items (from Wardrobe page) and try to find their roles from outfit
  selectedBaseItems.value.forEach(item => {
    if (item.id) {
      const id = String(item.id)
      currentSelectedIds.add(id)
      
      // Try to find role from outfit first (most accurate)
      const roleFromOutfit = outfit.items.find(outfitItem => 
        outfitItem.wardrobe_id === id
      )?.role
      
      if (roleFromOutfit) {
        currentSelectedRoles.add(roleFromOutfit)
        // Update role mapping
        updateRoleMap((map) => {
          map.set(id, roleFromOutfit)
        })
      } else {
        // Fallback to existing mapping if available
        const role = activeWardrobeRoleMap.value.get(id)
        if (role) {
          currentSelectedRoles.add(role)
        }
      }
    }
  })
  
  // If there are any selected items, only add items for roles that are not already selected
  // Otherwise, add all items (first time application with no pre-selection)
  const hasSelectedItems = currentSelectedIds.size > 0
  
  if (hasSelectedItems) {
    // Supplement mode: only add items for roles that are not in current selection
    const outfitRoles = new Set(outfit.items.map(item => item.role))
    const missingRoles = Array.from(outfitRoles).filter(role => !currentSelectedRoles.has(role))
    
    // Add selected base items to activeWardrobeIds if not already there
    selectedBaseItems.value.forEach(item => {
      if (item.id) {
        const id = String(item.id)
        if (!activeWardrobeIds.value.includes(id)) {
          activeWardrobeIds.value.push(id)
          // Role mapping should already be set above
        }
      }
    })
    
    // Add items for missing roles only (don't add items that are already selected)
    outfit.items.forEach(item => {
      if (item.wardrobe_id && missingRoles.includes(item.role)) {
        const id = String(item.wardrobe_id)
        // Double check: don't add if already in activeWardrobeIds or currentSelectedIds
        if (!currentSelectedIds.has(id) && !activeWardrobeIds.value.includes(id)) {
          activeWardrobeIds.value.push(id)
          updateRoleMap((map) => {
            map.set(id, item.role)
          })
        }
      }
    })
    
    // Update or create original outfit for tracking
    if (originalAppliedOutfit.value) {
      // Merge new items into original outfit
      outfit.items.forEach(item => {
        if (item.wardrobe_id && missingRoles.includes(item.role)) {
          const existingItem = originalAppliedOutfit.value!.items.find(
            origItem => origItem.role === item.role && origItem.wardrobe_id === item.wardrobe_id
          )
          if (!existingItem) {
            originalAppliedOutfit.value!.items.push(item)
          }
        }
      })
      // Also add selected base items that are in outfit to original outfit
      selectedBaseItems.value.forEach(item => {
        if (item.id) {
          const outfitItem = outfit.items.find(outfitItem => outfitItem.wardrobe_id === String(item.id))
          if (outfitItem) {
            const existingItem = originalAppliedOutfit.value!.items.find(
              origItem => origItem.role === outfitItem.role && origItem.wardrobe_id === outfitItem.wardrobe_id
            )
            if (!existingItem) {
              originalAppliedOutfit.value!.items.push(outfitItem)
            }
          }
        }
      })
    } else {
      // Create original outfit from current selection + new items
      const allItems: typeof outfit.items = []
      
      // Add items from outfit that match selected base items
      selectedBaseItems.value.forEach(item => {
        if (item.id) {
          const outfitItem = outfit.items.find(outfitItem => outfitItem.wardrobe_id === String(item.id))
          if (outfitItem) {
            allItems.push(outfitItem)
          }
        }
      })
      
      // Add items for missing roles
      outfit.items.forEach(item => {
        if (item.wardrobe_id && missingRoles.includes(item.role)) {
          allItems.push(item)
        }
      })
      
      originalAppliedOutfit.value = {
        title: outfit.title,
        items: allItems,
        reason: outfit.reason,
        long_text: outfit.long_text
      }
    }
    
    selectedItem.value = null
    selectedItemIds.value = [] // Clear selected base items after applying
    
    console.log('=== Apply Outfit (Supplement Mode) ===')
    console.log('Active wardrobe IDs after supplement:', activeWardrobeIds.value)
    console.log('Current uploadedItems count:', uploadedItems.value.length)
  } else {
    // First time application with no pre-selection: add all items
    const ids = outfit.items
      .map((it) => it.wardrobe_id)
      .filter((id): id is string => !!id)
      .map((id) => String(id))

    console.log('=== Apply Outfit (First Time) ===')
    console.log('Outfit items:', outfit.items)
    console.log('Extracted wardrobe IDs:', ids)
    console.log('Current uploadedItems count:', uploadedItems.value.length)
    console.log('Uploaded items IDs:', uploadedItems.value.map(it => String(it.id)))

    activeWardrobeIds.value = ids
    selectedItem.value = null
    selectedItemIds.value = []

    // Store the original outfit for tracking missing roles
    originalAppliedOutfit.value = outfit

    // Store the role mapping for each wardrobe item
    updateRoleMap((map) => {
      map.clear()
      outfit.items.forEach(item => {
        if (item.wardrobe_id) {
          map.set(String(item.wardrobe_id), item.role)
        }
      })
    })
    
    // Check if items can be found
    const foundItems = ids.map(id => uploadedItems.value.find(it => String(it.id) === id)).filter(Boolean)
    console.log('Found items count:', foundItems.length, 'out of', ids.length)
  }
  
  // Verify that activeWardrobeItems will have items after applying
  console.log('[Apply Outfit] After applying:')
  console.log('  activeWardrobeIds:', activeWardrobeIds.value)
  console.log('  uploadedItems count:', uploadedItems.value.length)
  console.log('  activeWardrobeItems will have:', activeWardrobeItems.value.length, 'items')

  // Apply == auto-save to history
  try {
    // Map to backend SaveLookRequest format
    const saveLookData = {
      title: outfit.title,
      items: outfit.items.map(item => ({
        wardrobe_id: item.wardrobe_id || null,
        role: item.role,
        description: item.description,
      })),
      location: null, // Location is optional, can be extracted from prompt if needed
      prompt: outfit.long_text || outfit.reason, // Use long_text if available, otherwise reason
      background_image_url: backgroundImageUrl.value || null,
    }
    await apiClient.post('/looks', saveLookData)
  } catch (error) {
    console.error('Failed to auto-save applied outfit:', error)
      // Don't throw - saving to history is optional
    }
  
  // State is automatically persisted by Pinia store
    if (cardIndex !== undefined) {
      appliedOutfitIndex.value = cardIndex
      setTimeout(() => {
        appliedOutfitIndex.value = null
      }, 1500)
    }
  } catch (error) {
    console.error('[Apply Outfit] Error:', error)
    const errorMessage = error instanceof Error ? error.message : t('errors.generic')
    alert(t('studio.outfitPlans.applyFailed', { error: errorMessage }))
  } finally {
    if (cardIndex !== undefined) {
      applyingOutfitIndex.value = null
    }
  }
}

// Get missing roles (roles that were in the original outfit but are now deleted)
const getMissingRoles = (): string[] => {
  if (!originalAppliedOutfit.value) {
    return []
  }
  
  // Count roles in original outfit
  const originalRoleCount = new Map<string, number>()
  originalAppliedOutfit.value.items.forEach(item => {
    if (item.wardrobe_id) {
      const count = originalRoleCount.get(item.role) || 0
      originalRoleCount.set(item.role, count + 1)
    }
  })
  
  // Count currently active roles
  const activeRoleCount = new Map<string, number>()
  activeWardrobeIds.value.forEach(id => {
    const role = activeWardrobeRoleMap.value.get(String(id))
    if (role) {
      const count = activeRoleCount.get(role) || 0
      activeRoleCount.set(role, count + 1)
    }
  })
  
  // Find missing roles (roles that had items in original but have fewer or no items now)
  const missing: string[] = []
  originalRoleCount.forEach((originalCount, role) => {
    const activeCount = activeRoleCount.get(role) || 0
    if (activeCount < originalCount) {
      // This role is missing some items, but we only mark it as missing if all items are gone
      // OR we can mark it as partially missing - for now, let's mark it if any items are missing
      // Actually, let's be more precise: mark as missing only if all items of this role are gone
      if (activeCount === 0) {
        missing.push(role)
      }
    }
  })
  
  return missing
}

// Remove an item from active outfit
const removeActiveItem = (itemId: string) => {
  const itemIdStr = String(itemId)
  activeWardrobeIds.value = activeWardrobeIds.value.filter(id => String(id) !== itemIdStr)
  // Also remove from role map to keep data consistent
  updateRoleMap((map) => {
    map.delete(itemIdStr)
  })
  
  // Sync to Pinia so Wardrobe page can reflect the change
  selectedItemIds.value = selectedItemIds.value.filter(id => String(id) !== itemIdStr)
  
  // If all items are removed, clear the original outfit
  if (activeWardrobeIds.value.length === 0) {
    originalAppliedOutfit.value = null
    updateRoleMap((map) => {
      map.clear()
    })
  }
}

// Image viewer functions
const openImageViewer = (index: number) => {
  const validImages = activeWardrobeItems.value
    .map((item) => item.url || item.features.path)
    .filter((url): url is string => !!url)
  
  if (validImages.length === 0) return
  
  imageViewerImages.value = validImages
  // Find the actual index in the filtered array
  let actualIndex = 0
  let count = 0
  for (let i = 0; i < activeWardrobeItems.value.length; i++) {
    const item = activeWardrobeItems.value[i]
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

function onImageViewerClose(open: boolean) {
  showImageViewer.value = open
  if (!open) {
    imageViewerImages.value = []
    currentImageIndex.value = 0
  }
}

// Open image viewer for try-on result
const openTryOnImageViewer = () => {
  if (!tryOnImageUrl.value) return
  imageViewerImages.value = [tryOnImageUrl.value]
  currentImageIndex.value = 0
  showImageViewer.value = true
}

// Favorite functionality
const isSavingFavorite = ref(false)
// favoriteSaved and currentFavoriteId are now managed by Pinia store (computed above)

// Check if current try-on result is already in favorites
const checkFavoriteStatus = async () => {
  if (!tryOnImageUrl.value) {
    favoriteSaved.value = false
    currentFavoriteId.value = null
    return
  }
  
  try {
    const response = await apiClient.get<{ favorites: Array<{ id: string; image_url: string }> }>('/favorites')
    const favorite = response.data.favorites.find(f => f.image_url === tryOnImageUrl.value)
    if (favorite) {
      studioStore.setFavoriteStatus(true, favorite.id)
      console.log('[checkFavoriteStatus] Found existing favorite:', favorite.id)
    } else {
      studioStore.setFavoriteStatus(false, null)
    }
  } catch (error: any) {
    console.error('[checkFavoriteStatus] Failed to check favorite status:', error)
    // On error, assume not saved
    favoriteSaved.value = false
    currentFavoriteId.value = null
  }
}

const saveFavorite = async () => {
  if (!tryOnImageUrl.value) {
    alert('No try-on result to save as favorite.')
    return
  }

  // If already saved, delete the favorite (unfavorite)
  if (favoriteSaved.value && currentFavoriteId.value) {
    isSavingFavorite.value = true
    try {
      await apiClient.delete(`/favorites/${currentFavoriteId.value}`)
      studioStore.setFavoriteStatus(false, null)
      console.log('[saveFavorite] Favorite removed')
    } catch (error: any) {
      console.error('Failed to remove favorite:', error)
      alert(error?.response?.data?.detail || 'Failed to remove favorite, please try again later.')
    } finally {
      isSavingFavorite.value = false
    }
    return
  }

  // Otherwise, save as favorite
  isSavingFavorite.value = true
  studioStore.setFavoriteStatus(false, null)

  try {
    // Get garment URLs from active wardrobe items
    const garmentUrls = activeWardrobeItems.value
      .map((item) => item.url || item.features.path)
      .filter((u): u is string => !!u)
    
    // Find model image ID if using historical image
    let modelImageId: string | undefined = undefined
    if (modelImagePreviewUrl.value && !modelImageFile.value) {
      // If using historical image, find its ID
      const modelImage = historicalModelImages.value.find(
        img => img.image_url === modelImagePreviewUrl.value
      )
      if (modelImage) {
        modelImageId = modelImage.id
      }
    }
    
    // The image is already uploaded to R2, so we can use the URL directly
    const response = await apiClient.post<{ id: string; image_url: string }>('/favorites', {
      image_url: tryOnImageUrl.value,
      title: originalAppliedOutfit.value?.title || 'Try-on result',
      garment_urls: garmentUrls.length > 0 ? garmentUrls : undefined,
      background_image_url: backgroundImageUrl.value || undefined,
      prompt: customPrompt.value || undefined,
      model_image_url: modelImagePreviewUrl.value || undefined,
      model_image_id: modelImageId,
    })
    
    studioStore.setFavoriteStatus(true, response.data.id)
    console.log('Favorite saved:', response.data)
  } catch (error: any) {
    console.error('Failed to save favorite:', error)
    alert(error?.response?.data?.detail || 'Failed to save favorite, please try again later.')
  } finally {
    isSavingFavorite.value = false
  }
}

// Helper function to translate role names
const translateRole = (role: string): string => {
  const roleKey = role.toLowerCase()
  const roleMap: Record<string, string> = {
    top: t('studio.outfitPlans.roles.top'),
    bottom: t('studio.outfitPlans.roles.bottom'),
    outer: t('studio.outfitPlans.roles.outer'),
    shoes: t('studio.outfitPlans.roles.shoes'),
    accessory: t('studio.outfitPlans.roles.accessory'),
  }
  return roleMap[roleKey] || role
}

// Unmatched outfit items (no wardrobe_id or not in uploadedItems) with description, for text-only try-on prompt
const unmatchedOutfitDescriptions = computed(() => {
  const items = originalAppliedOutfit.value?.items ?? []
  return items
    .filter((it) => {
      if (!it.wardrobe_id) return !!(it.description ?? '').trim()
      return !uploadedItems.value.some((u) => String(u.id) === String(it.wardrobe_id)) && !!(it.description ?? '').trim()
    })
    .map((it) => ({ role: it.role ?? '', description: (it.description ?? '').trim() }))
    .filter((it) => it.description.length > 0)
})

const hasTryOnInput = computed(
  () => activeWardrobeItems.value.length > 0 || unmatchedOutfitDescriptions.value.length > 0,
)

// Note: Stepper is rendered in AppLayout top bar when route is studio. State from useStudioStore().
// Note: Multi-angle generation is now in separate MultiAngle.vue page

</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <div class="px-4 sm:px-6">
      <main class="space-y-[20px] max-w-4xl mx-auto px-4 sm:px-6">
      <!-- Model photo uploader (moved to top) -->
      <section class="bg-white p-8 rounded-2xl shadow-sm border border-pink-100 flex flex-col gap-8">
        <div>
          <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
            {{ $t('studio.modelPhoto.title') }}
          </h2>
        </div>

        <!-- Model photo uploader with integrated empty state -->
        <div
          data-model-uploader
          :class="[
            'border rounded-xl bg-white transition-all focus-within:shadow-md overflow-hidden',
            showModelImageError ? 'border-red-500 border-2 shadow-red-200' : 'border-gray-200 focus-within:border-gray-400',
          ]"
        >
          <!-- Model photo preview or empty state -->
          <div v-if="modelImagePreviewUrl || isUploadingModelImage" class="p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="text-sm font-medium text-gray-700 mb-1">{{ $t('studio.modelPhoto.title') }}</p>
                <p class="text-xs text-pink-500">
                  {{ $t('studio.modelPhoto.description') }}
                </p>
              </div>
              <button
                v-if="modelImagePreviewUrl && !isUploadingModelImage"
                @click="removeModelImage"
                class="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md flex-shrink-0"
                :title="$t('studio.modelPhoto.deleteModelPhoto')"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">
              <img
                v-if="modelImagePreviewUrl"
                :src="getMediumImageUrl(modelImagePreviewUrl)"
                loading="lazy"
                :alt="$t('studio.modelPhoto.modelPreview')"
                class="w-full h-full object-cover"
              />
              <!-- Upload progress overlay -->
              <div
                v-if="isUploadingModelImage"
                class="absolute inset-0 bg-gray-900/50 flex flex-col items-center justify-center"
              >
                <div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                <span class="text-white text-xs">{{ modelImageUploadProgress }}%</span>
              </div>
              <!-- Progress bar -->
              <div v-if="isUploadingModelImage" class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                <div
                  class="h-full bg-blue-500 transition-all duration-300"
                  :style="{ width: `${modelImageUploadProgress}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Empty state with upload button -->
          <div v-else class="p-8">
            <div class="text-center">
              <Wand2 class="w-12 h-12 mx-auto mb-3 text-pink-600" />
              <div class="flex flex-col items-center gap-3">
                <div class="flex items-center gap-3">
                  <label
                    for="modelImageInput"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-pink-200 hover:border-pink-600 hover:text-gray-900 cursor-pointer transition-colors"
                  >
                    <Upload class="w-4 h-4" />
                    <span>{{ $t('studio.modelPhoto.uploadNewPhoto') }}</span>
                  </label>
                  <input
                    id="modelImageInput"
                    type="file"
                    accept="image/*"
                    @change="handleModelImageChange"
                    class="hidden"
                  />
                  <button
                    v-if="historicalModelImages.length > 0"
                    @click="showModelImageHistory = !showModelImageHistory"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-pink-200 hover:border-pink-600 hover:text-gray-900 cursor-pointer transition-colors"
                  >
                    <Clock class="w-4 h-4" />
                    <span>{{ $t('studio.modelPhoto.history') }}</span>
                  </button>
                  <button
                    @click="showExampleModelImages = !showExampleModelImages"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-pink-200 hover:border-pink-600 hover:text-gray-900 cursor-pointer transition-colors"
                  >
                    <Image class="w-4 h-4" />
                    <span>{{ $t('studio.example') }}</span>
                  </button>
                </div>
                <p class="text-xs text-pink-600">
                  {{ $t('studio.modelPhoto.description') }}
                </p>
              </div>
            </div>
          </div>

          <!-- Upload button when photo exists (for replacement) -->
          <div v-if="modelImagePreviewUrl" class="px-4 pb-4 border-t border-gray-100 pt-3">
            <div class="flex items-center gap-2">
              <label
                for="modelImageInputReplace"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-pink-600 hover:text-gray-900 hover:bg-pink-50 cursor-pointer transition-colors"
              >
                <Upload class="w-4 h-4" />
                <span>{{ t('studio.modelPhoto.replacePhoto') }}</span>
              </label>
              <input
                id="modelImageInputReplace"
                type="file"
                accept="image/*"
                @change="handleModelImageChange"
                class="hidden"
              />
              <button
                v-if="historicalModelImages.length > 0"
                @click="showModelImageHistory = !showModelImageHistory"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-pink-600 hover:text-gray-900 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Clock class="w-4 h-4" />
                <span>{{ $t('studio.modelPhoto.history') }}</span>
              </button>
              <button
                @click="showExampleModelImages = !showExampleModelImages"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-pink-600 hover:text-gray-900 hover:bg-pink-50 cursor-pointer transition-colors"
              >
                <Image class="w-4 h-4" />
                <span>{{ $t('studio.example') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Historical model images modal -->
        <div
          v-if="showModelImageHistory"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="showModelImageHistory = false"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Choose a historical model image</h3>
              <button
                @click="showModelImageHistory = false"
                class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X class="w-5 h-5 text-pink-500" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div v-if="historicalModelImages.length === 0" class="text-center py-12 text-pink-400">
                <Clock class="w-12 h-12 mx-auto mb-3 text-pink-300" />
                <p>No historical model images</p>
              </div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div
                  v-for="image in historicalModelImages"
                  :key="image.id"
                  @click="selectHistoricalModelImage(image)"
                  class="group relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-xl"
                >
                  <img
                    :src="getThumbnailUrl(image.image_url)"
                    loading="lazy"
                    :alt="`Model image ${image.id}`"
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                  <!-- Delete button -->
                  <button
                    @click.stop="deleteHistoricalModelImage(image, $event)"
                    class="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg z-10"
                    title="Delete this image"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                  <div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="bg-white/90 backdrop-blur-sm rounded px-3 py-2 text-sm text-gray-700">
                      {{ new Date(image.created_at).toLocaleDateString('en-US') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Example model images modal -->
        <div
          v-if="showExampleModelImages"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="showExampleModelImages = false"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">{{ $t('studio.chooseExampleModel') }}</h3>
              <button
                @click="showExampleModelImages = false"
                class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X class="w-5 h-5 text-pink-500" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div v-if="exampleModelImages.length === 0" class="text-center py-12 text-pink-400">
                <Image class="w-12 h-12 mx-auto mb-3 text-pink-300" />
                <p>{{ $t('studio.noExampleModel') }}</p>
              </div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div
                  v-for="(imageUrl, index) in exampleModelImages"
                  :key="index"
                  @click="selectExampleModelImage(imageUrl)"
                  class="group relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-xl"
                >
                  <img
                    :src="getMediumImageUrl(imageUrl)"
                    loading="lazy"
                    :alt="`Example model ${index + 1}`"
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                  <div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="bg-white/90 backdrop-blur-sm rounded px-3 py-2 text-sm font-medium text-gray-700 text-center">
                      {{ $t('studio.clickToUse') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Describe today & generate outfits -->
      <section class="bg-white p-8 rounded-2xl shadow-sm border border-pink-100 flex flex-col gap-4">
        <div>
          <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ $t('studio.tellAIAboutDay') }}</h2>
        </div>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-4">
            <!-- Tabs for background image options (horizontal, fixed width, left-aligned) -->
            <Tabs v-model="backgroundTabValue" default-value="no-background" class="w-full">
              <TabsList class="inline-flex items-center justify-start h-auto w-auto p-1 bg-muted rounded-lg">
                <TabsTrigger 
                  value="no-background"
                  class="min-w-[120px] max-w-[160px] px-4 py-2 text-sm font-medium text-center bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent data-[state=active]:bg-background data-[state=active]:opacity-100 data-[state=inactive]:opacity-60 hover:opacity-100 transition-all duration-200 cursor-pointer"
                >
                  {{ $t('studio.noBackgroundImage') }}
                </TabsTrigger>
                <TabsTrigger 
                  value="with-background"
                  class="min-w-[120px] max-w-[160px] px-4 py-2 text-sm font-medium text-center bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent data-[state=active]:bg-background data-[state=active]:opacity-100 data-[state=inactive]:opacity-60 hover:opacity-100 transition-all duration-200 cursor-pointer"
                >
                  {{ $t('studio.withBackgroundImage') }}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <!-- Content area -->
            <div class="w-full space-y-4">
              <!-- Action prompt input (only shown in "with-background" tab) -->
              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="opacity-0 -translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-200 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-2"
              >
                <div v-if="backgroundTabValue === 'with-background'" class="space-y-2">
                  <div class="relative border border-pink-200 rounded-xl bg-white transition-all focus-within:border-pink-400 focus-within:shadow-md">
                    <div class="flex items-center gap-2 px-4 py-3">
                      <input
                        v-model="backgroundActionPrompt"
                        type="text"
                        class="flex-1 text-sm focus:outline-none border-0 placeholder:text-pink-600 bg-transparent"
                        :placeholder="$t('studio.backgroundActionPromptPlaceholder')"
                      />
                      <div class="flex items-center gap-2 border-l border-pink-100 pl-3">
                        <!-- Background image preview -->
                        <div v-if="backgroundImagePreviewUrl || isUploadingBackgroundImage" class="relative">
                          <div class="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">
                            <img 
                              v-if="backgroundImagePreviewUrl"
                              :src="getSmallImageUrl(backgroundImagePreviewUrl)" 
                              loading="lazy"
                              alt="Background preview" 
                              class="w-full h-full object-cover"
                            />
                            <!-- Upload progress overlay -->
                            <div
                              v-if="isUploadingBackgroundImage"
                              class="absolute inset-0 bg-gray-900/50 flex items-center justify-center"
                            >
                              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          </div>
                          <button
                            v-if="backgroundImagePreviewUrl && !isUploadingBackgroundImage"
                            @click="removeBackgroundImage"
                            class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md cursor-pointer"
                            :title="$t('studio.deleteBackgroundImage')"
                          >
                            <X class="w-3 h-3" />
                          </button>
                        </div>
                        <!-- Upload button -->
                        <label
                          for="backgroundImageInput"
                          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-pink-600 hover:text-gray-900 hover:bg-pink-50 cursor-pointer transition-colors duration-200"
                          :title="$t('studio.uploadBackgroundImage')"
                        >
                          <Upload class="w-4 h-4" />
                          <span class="hidden sm:inline">{{ $t('studio.uploadBackgroundImage') }}</span>
                        </label>
                        <input
                          id="backgroundImageInput"
                          type="file"
                          accept="image/*"
                          @change="handleBackgroundImageChange"
                          class="hidden"
                        />
                        <!-- History button -->
                        <button
                          @click="showBackgroundImageHistory = !showBackgroundImageHistory"
                          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-pink-600 hover:text-gray-900 hover:bg-pink-50 cursor-pointer transition-colors duration-200"
                          :title="$t('studio.pickFromBackgroundHistory')"
                        >
                          <Clock class="w-4 h-4" />
                          <span class="hidden sm:inline">{{ $t('studio.viewHistory') }}</span>
                        </button>
                        <!-- Example button -->
                        <button
                          @click="showExampleBackgroundImages = !showExampleBackgroundImages"
                          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-pink-600 hover:text-gray-900 hover:bg-pink-50 cursor-pointer transition-colors duration-200"
                          :title="$t('studio.chooseExampleBackground')"
                        >
                          <Image class="w-4 h-4" />
                          <span class="hidden sm:inline">{{ $t('studio.example') }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
              
              <!-- Style prompt textarea (shown in both tabs) -->
              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="opacity-0 translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-200 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 translate-y-2"
              >
                <div class="relative border border-pink-200 rounded-xl bg-white transition-all focus-within:border-pink-400 focus-within:shadow-md">
                  <textarea
                    v-model="customPrompt"
                    rows="3"
                    class="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none border-0 placeholder:text-pink-600"
                    :placeholder="$t('studio.promptPlaceholder')"
                  ></textarea>
                </div>
              </Transition>
            </div>
          </div>
        
        <!-- Historical background images modal -->
        <div
              v-if="showBackgroundImageHistory"
              class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              @click.self="showBackgroundImageHistory = false"
            >
              <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
                <div class="flex items-center justify-between p-6 border-b border-gray-200">
                  <h3 class="text-lg font-semibold text-gray-900">{{ $t('studio.chooseHistoricalBackground') }}</h3>
                  <button
                    @click="showBackgroundImageHistory = false"
                    class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                  >
                    <X class="w-5 h-5 text-pink-500" />
                  </button>
                </div>
                <div class="flex-1 overflow-y-auto p-6">
                  <div v-if="historicalBackgroundImages.length === 0" class="text-center py-12 text-pink-400">
                    <Clock class="w-12 h-12 mx-auto mb-3 text-pink-300" />
                    <p>{{ $t('studio.noHistoricalBackground') }}</p>
                  </div>
                  <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div
                      v-for="image in historicalBackgroundImages"
                      :key="image.id"
                      @click="selectHistoricalBackgroundImage(image)"
                      class="group relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-xl"
                    >
                      <img
                        :src="getThumbnailUrl(image.image_url)"
                        loading="lazy"
                        :alt="`Background image ${image.id}`"
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                      <!-- Delete button -->
                      <button
                        @click.stop="deleteHistoricalBackgroundImage(image, $event)"
                        class="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg z-10"
                        title="Delete this image"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                      <div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="bg-white/90 backdrop-blur-sm rounded px-3 py-2 text-sm text-gray-700">
                          {{ new Date(image.created_at).toLocaleDateString('en-US') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button 
              @click="getRecommendations" 
              :disabled="isGenerating"
              class="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 transition-colors shadow-lg shadow-pink-500/20 w-full justify-center sm:w-auto"
            >
              <Wand2 class="w-5 h-5" />
              {{ isGenerating ? $t('studio.aiThinking') : $t('studio.generateOutfit') }}
            </button>
            <!-- AI branding and transparency note -->
            <div class="flex items-center gap-2 text-xs text-pink-600">
              <span class="font-medium text-gray-700">fashion</span>
              <span class="text-pink-400">|</span>
              <span>Powered by Qwen</span>
              <span class="text-pink-400">|</span>
              <span class="text-pink-400">Independent service</span>
            </div>
          </div>
          
          <!-- AI Outfit Plans：轮播布局，卡片内介绍在前、各部位选择在后 -->
          <div v-if="agentOutfits.length && !isGenerating" class="mt-6 px-14">
            <h3 class="text-lg font-semibold mb-3">{{ $t('studio.outfitPlans.title') }}</h3>
            <Carousel class="w-full">
              <CarouselContent>
                <CarouselItem
                  v-for="(outfit, idx) in agentOutfits"
                  :key="idx"
                >
                  <div class="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col justify-between">
                    <div>
                      <h4 class="font-semibold text-sm mb-2">{{ outfit.title }}</h4>
                      <p class="text-xs text-pink-500 mb-2">{{ outfit.reason }}</p>
                      <p class="text-xs text-pink-500 whitespace-pre-line mb-3">{{ outfit.long_text }}</p>
                      <ul class="text-xs text-gray-700 space-y-1">
                        <li v-for="(it, i) in outfit.items" :key="i" class="flex items-start justify-between gap-2">
                          <div class="flex-1">
                            <span class="font-medium capitalize">{{ translateRole(it.role) }}:</span>
                            <span> {{ it.description }}</span>
                            <span v-if="findWardrobeItemById(it.wardrobe_id)" class="text-pink-600 ml-1">{{ $t('studio.outfitPlans.inWardrobe') }}</span>
                            <span v-if="it.wardrobe_id && activeWardrobeIds.includes(String(it.wardrobe_id))" class="text-blue-600 ml-1">{{ $t('studio.outfitPlans.selected') }}</span>
                          </div>
                        </li>
                      </ul>
                    </div>
                    <div class="mt-3 flex flex-col gap-2">
                      <button
                        v-if="outfit.items && outfit.items.length > 0"
                        type="button"
                        :disabled="applyingOutfitIndex !== null"
                        @click.prevent="applyOutfit(outfit, idx)"
                        class="inline-flex items-center justify-center gap-1.5 min-w-[5rem] text-xs px-3 py-1.5 rounded-full border transition-all duration-200 self-end select-none"
                        :class="applyingOutfitIndex === idx
                          ? 'border-blue-300 text-blue-500 cursor-wait'
                          : appliedOutfitIndex === idx
                            ? 'border-green-400 text-green-600 bg-green-50'
                            : 'border-blue-400 text-blue-600 hover:border-blue-600 hover:text-blue-700 hover:scale-[1.02] active:scale-[0.98]'"
                      >
                        <span
                          v-if="applyingOutfitIndex === idx"
                          class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
                        />
                        <Check v-else-if="appliedOutfitIndex === idx" class="w-3.5 h-3.5 shrink-0" />
                        <span>{{ applyingOutfitIndex === idx ? $t('studio.outfitPlans.applying') : appliedOutfitIndex === idx ? $t('studio.outfitPlans.applied') : $t('studio.outfitPlans.applyOutfit') }}</span>
                      </button>
                    </div>
                  </div>
                </CarouselItem>
              </CarouselContent>
            </Carousel>
          </div>
          
          <!-- Loading State (only show when actively generating) -->
          <div v-else-if="isGenerating" class="mt-6 py-12 flex flex-col items-center justify-center">
             <div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
             <p class="text-pink-600 animate-pulse mb-2">{{ $t('studio.consultingKnowledgeBase') }}</p>
             
          </div>
        </div>
      </section>

      <!-- Applied Outfit Items - Independent Section -->
      <section class="bg-white p-8 rounded-2xl shadow-sm border border-pink-100 flex flex-col gap-4">
        <div>
          <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ $t('studio.appliedOutfitItems.title') }}</h2>
          <p class="text-sm text-gray-700">
            {{ $t('studio.appliedOutfitItems.description') }}
          </p>
        </div>
        
        <div class="p-4 border border-pink-100 rounded-xl bg-pink-50/50">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-gray-700">
              {{ $t('studio.appliedOutfitItems.itemsCount', { count: activeWardrobeItems.length }) }}
            </p>
            <p v-if="getMissingRoles().length > 0" class="text-xs text-pink-600">
              {{ $t('studio.appliedOutfitItems.rolesRemoved', { count: getMissingRoles().length }) }}
            </p>
          </div>
          
          <!-- Empty state -->
          <div v-if="activeWardrobeItems.length === 0" class="py-8 text-center">
            <Shirt class="w-12 h-12 mx-auto mb-3 text-pink-600" />
            <p class="text-sm text-gray-700 mb-2">{{ $t('studio.appliedOutfitItems.noItemsSelected') }}</p>
            <p class="text-xs text-pink-600 mb-4">{{ $t('studio.appliedOutfitItems.goToWardrobePrompt') }}</p>
            <button
              @click="$router.push('/wardrobe')"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-pink-200 text-gray-700 hover:border-pink-600 hover:text-gray-900 transition-colors"
            >
              <Shirt class="w-4 h-4" />
              {{ $t('studio.appliedOutfitItems.goToWardrobe') }}
            </button>
          </div>
          
          <!-- Items display -->
          <div v-else class="flex flex-wrap gap-3 mb-3">
            <div
              v-for="(item, index) in activeWardrobeItems"
              :key="item.id"
              class="group relative"
            >
              <div class="relative">
                <div
                  @click="openImageViewer(index)"
                  class="cursor-pointer"
                >
                  <div class="w-20 h-20 rounded-lg overflow-hidden border-2 border-pink-200 hover:border-pink-500 transition-all hover:shadow-lg bg-pink-100">
                    <img
                      v-if="item.url || item.features.path"
                      :src="getSmallImageUrl((item.url || item.features.path) || '')"
                      loading="lazy"
                      class="w-full h-full object-cover"
                      :alt="`${formatFeatureValue(item.features.color)} ${formatFeatureValue(item.features.type)}`"
                    />
                  </div>
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg pointer-events-none"></div>
                </div>
                <!-- Delete button - always visible -->
                <button
                  @click.stop="removeActiveItem(String(item.id))"
                  class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md z-10"
                  :title="$t('studio.appliedOutfitItems.deleteItem')"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
              <div class="mt-1 text-center">
                <p class="text-xs text-gray-700 truncate max-w-[80px]">
                  {{ formatFeatureValue(item.features.color) }} {{ formatFeatureValue(item.features.type) }}
                </p>
                <p v-if="activeWardrobeRoleMap.get(String(item.id))" class="text-xs text-pink-600 truncate max-w-[80px]">
                  {{ activeWardrobeRoleMap.get(String(item.id)) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Step 2 moved to dedicated Wardrobe page -->

      <!-- Step 3: Review outfits & virtual try-on -->
      <section class="bg-white p-8 rounded-2xl shadow-sm border border-pink-100 flex flex-col gap-8">
        <div>
          <h2 class="text-2xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">{{ $t('studio.reviewOutfits') }}</h2>
        </div>

        <!-- Example background images modal -->
        <div
          v-if="showExampleBackgroundImages"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="showExampleBackgroundImages = false"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">{{ $t('studio.chooseExampleBackground') }}</h3>
              <button
                @click="showExampleBackgroundImages = false"
                class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X class="w-5 h-5 text-pink-500" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div v-if="exampleBackgroundImages.length === 0" class="text-center py-12 text-pink-400">
                <Image class="w-12 h-12 mx-auto mb-3 text-pink-300" />
                <p>{{ $t('studio.noExampleBackground') }}</p>
              </div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div
                  v-for="(image, index) in exampleBackgroundImages"
                  :key="index"
                  @click="selectExampleBackgroundImage(image)"
                  class="group relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-xl"
                >
                  <img
                    :src="getSmallImageUrl(image.url)"
                    loading="lazy"
                    :alt="`Example background ${index + 1}`"
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                  <div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="bg-white/90 backdrop-blur-sm rounded px-3 py-2 text-sm font-medium text-gray-700 text-center">
                      {{ $t('studio.clickToUse') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Try-on controls -->
        <div v-if="hasTryOnInput" class="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">{{ $t('studio.readyToTryOn') }}</p>
              <p class="text-xs text-pink-500">
                {{ activeWardrobeItems.length > 0 ? (activeWardrobeItems.length + ' items selected. ') : (unmatchedOutfitDescriptions.length + ' items described by text. ') }}Click below to generate a virtual try-on.
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              @click="performTryOn"
              :disabled="!hasTryOnInput || isTryingOn"
              class="px-4 py-2 rounded-lg border border-pink-500 text-pink-600 hover:border-pink-700 hover:text-pink-700 hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Wand2 v-if="!isTryingOn" class="w-4 h-4" />
              <div v-else class="w-4 h-4 border-2 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
              <span>{{ isTryingOn ? $t('studio.generatingTryOn') : $t('studio.tryOnThisOutfit') }}</span>
            </button>
           
          </div>
        </div>

        <!-- Try-on Loading State -->
        <div v-if="isTryingOn && !tryOnImageUrl" class="py-12 flex flex-col items-center justify-center border border-pink-100 rounded-xl bg-pink-50">
          <div class="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p class="text-gray-700 animate-pulse mb-2">{{ $t('studio.generatingVirtualTryOn') }}</p>
          <!-- AI branding and transparency note (loading) -->
        </div>

        <!-- Recommendations -->
        <div v-if="selectedItem && recommendations.length > 0">
          <h3 class="text-lg font-semibold mb-4">{{ $t('studio.aiSuggestions') }}</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div v-for="rec in recommendations" :key="rec.id" class="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow">
              <div class="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center text-pink-400 overflow-hidden">
                <img 
                  v-if="rec.path && rec.path.startsWith('http')" 
                  :src="getThumbnailUrl(rec.path)" 
                  loading="lazy"
                  class="w-full h-full object-cover"
                />
                <span v-else>{{ rec.type }}</span>
              </div>
              <p class="font-medium text-sm">{{ rec.color }} {{ rec.type }}</p>
              <p class="text-xs text-pink-500 mt-1">{{ rec.reason }}</p>
              <p class="text-xs text-pink-600 mt-1 font-medium">Match: {{ Math.round(rec.score * 100) }}%</p>
            </div>
          </div>
        </div>

        <!-- Try-on Result -->
        <div v-if="tryOnImageUrl" class="border-t border-gray-100 pt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold">{{ $t('studio.virtualTryOn.title') }}</h3>
            <button
              @click="saveFavorite"
              :disabled="isSavingFavorite"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                favoriteSaved
                  ? 'bg-pink-50 text-pink-600 border border-pink-200'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300',
                isSavingFavorite && 'opacity-50 cursor-not-allowed'
              ]"
            >
              <Heart
                :class="[
                  'w-4 h-4 transition-all',
                  favoriteSaved ? 'fill-current text-pink-600' : ''
                ]"
              />
              <span v-if="isSavingFavorite">{{ $t('studio.virtualTryOn.saving') }}</span>
              <span v-else-if="favoriteSaved">{{ $t('studio.virtualTryOn.saved') }}</span>
              <span v-else>{{ $t('studio.virtualTryOn.favorite') }}</span>
            </button>
          </div>
          <div class="w-full max-w-md mx-auto rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-300 transition-colors" @click="openTryOnImageViewer">
            <img :src="getLargeImageUrl(tryOnImageUrl || '')" loading="lazy" :alt="$t('studio.virtualTryOn.tryOnResult')" class="w-full object-contain" />
          </div>
          
          <!-- Multi-Angle Link -->
          <div class="mt-4 flex justify-center">
            <router-link 
              :to="{ path: '/multi-angle', query: { sourceImage: tryOnImageUrl } }"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm text-pink-600 hover:text-pink-800 hover:bg-pink-50 rounded-lg transition-colors"
            >
              <RotateCw class="w-4 h-4" />
              <span>{{ $t('studio.virtualTryOn.viewMultiAngle') }}</span>
            </router-link>
          </div>
        </div>
      </section>
      </main>

      <!-- Footer -->
      <footer class="mt-12 pt-8 border-t border-pink-200 pb-8 max-w-4xl mx-auto px-4 sm:px-6">
      <div class="flex justify-center gap-6 text-sm text-pink-600">
        <router-link to="/privacy-policy" class="hover:text-gray-900 transition-colors">
          Privacy Policy
        </router-link>
        <span class="text-pink-300">|</span>
        <router-link to="/terms-of-service" class="hover:text-gray-900 transition-colors">
          Terms of Service
        </router-link>
      </div>
      <p class="text-center text-xs text-pink-600 mt-4">
        © 2025 Fashion Rec. All rights reserved.
      </p>
      </footer>
    </div>

    <!-- Image Viewer (shared component) -->
    <ImageViewer
      :open="showImageViewer"
      :images="imageViewerImages"
      :initial-index="currentImageIndex"
      :alt="$t('studio.virtualTryOn.tryOnResult')"
      @update:open="onImageViewerClose"
      @update:current-index="(i) => (currentImageIndex = i)"
    />
  </div>
</template>
