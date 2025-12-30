<script setup lang="ts">
defineOptions({ name: 'Studio' })
import { ref, onMounted, onUnmounted, onActivated, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Wand2, X, Clock, Upload, ChevronLeft, ChevronRight, Heart, Trash2, Shirt, Search } from 'lucide-vue-next'
import type { Item, Recommendation, AgentOutfit, AgentOutfitItem } from '../types'
import { supabase } from '../lib/supabase'
import { apiClient, uploadApiClient, subscriptionClient } from '../lib/api-client'
import { useStudioStore } from '../stores/studio'

const route = useRoute()
const router = useRouter()

// Initialize Pinia store
const studioStore = useStudioStore()

// Local state (not persisted)
const uploadedItems = ref<Item[]>([])
const selectedItem = ref<Item | null>(null)
const selectedItemIds = ref<string[]>([])
const recommendations = ref<Recommendation[]>([])
const modelImageFile = ref<File | null>(null)
const isGenerating = ref(false)
const isTryingOn = ref(false)

// Scene image file (not persisted, only URL is persisted)
const sceneImageFile = ref<File | null>(null)

// Use store state (automatically persisted)
const customPrompt = computed({
  get: () => studioStore.customPrompt,
  set: (value) => studioStore.setCustomPrompt(value)
})
const sceneImageUrl = computed({
  get: () => studioStore.sceneImageUrl,
  set: (value) => studioStore.setSceneImage(value, value)
})
const sceneImagePreviewUrl = computed({
  get: () => studioStore.sceneImagePreviewUrl,
  set: (value) => studioStore.setSceneImage(studioStore.sceneImageUrl, value)
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
  image_type: 'scene' | 'model'
  created_at: string
}
const historicalSceneImages = ref<HistoricalImage[]>([])
const historicalModelImages = ref<HistoricalImage[]>([])
const showSceneImageHistory = ref(false)
const showModelImageHistory = ref(false)

// Upload progress
const sceneImageUploadProgress = ref(0)
const isUploadingSceneImage = ref(false)

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

    const response = await subscriptionClient.get('/subscription/status', {
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
        console.log('[Studio] Restored items from sessionStorage:', items.length)
        return true
      }
    }
  } catch (e) {
    console.warn('Failed to restore items from sessionStorage:', e)
  }
  return false
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
    const [sceneResp, modelResp] = await Promise.all([
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=scene'),
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=model'),
    ])
    console.log('[loadHistoricalImages] Scene response:', sceneResp.data)
    console.log('[loadHistoricalImages] Model response:', modelResp.data)
    
    // Ensure we handle both response formats: { images: [...] } or direct array
    const sceneImages = sceneResp.data?.images || sceneResp.data || []
    const modelImages = modelResp.data?.images || modelResp.data || []
    
    historicalSceneImages.value = Array.isArray(sceneImages) ? sceneImages : []
    historicalModelImages.value = Array.isArray(modelImages) ? modelImages : []
    
    console.log('[loadHistoricalImages] Loaded scene images:', historicalSceneImages.value.length)
    console.log('[loadHistoricalImages] Loaded model images:', historicalModelImages.value.length)
  } catch (error) {
    console.error('[loadHistoricalImages] Failed to load historical images:', error)
    // Keep existing values on error, don't reset to empty
    // This prevents button from disappearing if a subsequent request fails
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

// Load items when component mounts
onMounted(async () => {
  // Load local selection state first and sync to activeWardrobeIds
  syncSelectedItemsToActiveWardrobe()

  // Try to restore items from cache first for instant display of Applied outfit items
  // These items are already loaded in Wardrobe page and saved to sessionStorage
  // Studio page doesn't need to load all items from backend - only items selected in Wardrobe are needed
  restoreItemsFromCache()
  
  // Studio state is automatically restored by Pinia store (no manual restore needed)
  // But we need to check favorite status if try-on image exists
  const lookId = route.query.lookId as string | undefined
  const tryonHistoryId = route.query.tryonHistoryId as string | undefined
  
  if (!lookId && !tryonHistoryId && tryOnImageUrl.value) {
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
  if (lookId) {
    console.log('[onMounted] Found lookId in query, restoring look:', lookId)
    // Items should be in cache from Wardrobe page, but if not, restoreLookFromHistory will handle it
    await restoreLookFromHistory(lookId)
  }
  
  // Check if we need to restore try-on history
  if (tryonHistoryId) {
    console.log('[onMounted] Found tryonHistoryId in query, restoring try-on history:', tryonHistoryId)
    await restoreTryOnHistory(tryonHistoryId)
  }
  
  window.addEventListener('keydown', handleKeyDown)
})

// Sync selectedItemIds from localStorage to activeWardrobeIds when component is activated
// This ensures items selected from Wardrobe page appear in Applied Outfit Items
const syncSelectedItemsToActiveWardrobe = () => {
  try {
    const saved = localStorage.getItem('fashion_rec_selected_items')
    if (saved) {
      const ids = JSON.parse(saved)
      if (Array.isArray(ids)) {
        selectedItemIds.value = ids
        // Merge selectedItemIds into activeWardrobeIds (add items that are not already there)
        const newIds = ids.filter(id => !activeWardrobeIds.value.includes(String(id)))
        if (newIds.length > 0) {
          activeWardrobeIds.value.push(...newIds.map(id => String(id)))
          console.log('[syncSelectedItemsToActiveWardrobe] Added new items to activeWardrobeIds:', newIds)
        }
      }
    }
  } catch (e) {
    console.error('Failed to sync selected items from localStorage:', e)
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
      scene: historicalSceneImages.value.length
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
    
    // Restore scene image
    if (restoreData.scene_image_url) {
      sceneImageUrl.value = restoreData.scene_image_url
      sceneImagePreviewUrl.value = restoreData.scene_image_url
      sceneImageFile.value = null
      console.log('[restoreTryOnHistory] Restored scene image:', restoreData.scene_image_url)
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
      sceneImageUrl: sceneImageUrl.value,
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
    
    // Restore scene image
    if (look.scene_image_url) {
      sceneImageUrl.value = look.scene_image_url
      sceneImagePreviewUrl.value = look.scene_image_url
      sceneImageFile.value = null // Clear file since we're using URL
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
        sceneImageUrl: sceneImageUrl.value,
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
  window.removeEventListener('keydown', handleKeyDown)
  // State is automatically persisted by Pinia store
})

// Upload and direct selection are handled on the Wardrobe page now.

const getRecommendations = async () => {
  isGenerating.value = true
  recommendations.value = []
  agentOutfits.value = []
  tryOnImageUrl.value = null

  try {
    // Scene image should already be uploaded in handleSceneImageChange
    // If we have a file but no URL, upload it now (fallback)
    if (sceneImageFile.value && !sceneImageUrl.value) {
      const formData = new FormData()
      formData.append('file', sceneImageFile.value)

      try {
        const resp = await uploadApiClient.post<{ url: string }>('/scene-image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        sceneImageUrl.value = resp.data.url
        await loadHistoricalImages()
      } catch (e: any) {
        console.error('Scene image upload failed:', e)
        alert(`Scene image upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
      }
    }

    const hasBaseSelection = selectedBaseItems.value.length > 0
    // Get currently active items as base (for supplementing deleted items)
    // Priority: activeWardrobeIds > selectedBaseItems
    let activeItemIds: string[] | undefined = undefined
    if (activeWardrobeIds.value.length > 0) {
      activeItemIds = activeWardrobeIds.value
    } else if (hasBaseSelection) {
      activeItemIds = selectedBaseItems.value
        .map((it) => it.id)
        .filter((id): id is string | number => id !== undefined)
        .map(id => String(id))
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
      scene_image_url: sceneImageUrl.value || undefined,
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

const handleSceneImageChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] || null
  if (!file) return

  sceneImageFile.value = file
  sceneImageUrl.value = null
  isUploadingSceneImage.value = true
  sceneImageUploadProgress.value = 0

  // Upload to backend and save to history
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    // Fallback progress simulation (in case onUploadProgress doesn't fire)
    let hasRealProgress = false
    const progressInterval = setInterval(() => {
      if (!hasRealProgress && sceneImageUploadProgress.value < 90) {
        sceneImageUploadProgress.value += 10
      }
    }, 200)
    
    const resp = await apiClient.post<{ url: string }>('/scene-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        hasRealProgress = true
        if (progressEvent.total) {
          sceneImageUploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        } else if (progressEvent.loaded) {
          // Estimate progress if total is unknown
          sceneImageUploadProgress.value = Math.min(90, Math.round((progressEvent.loaded / file.size) * 100))
        }
      },
    })
    
    clearInterval(progressInterval)
    sceneImageUploadProgress.value = 100
    sceneImageUrl.value = resp.data.url
    
    // Reload historical images
    await loadHistoricalImages()
    
    // Reset progress after a short delay
    setTimeout(() => {
      isUploadingSceneImage.value = false
      sceneImageUploadProgress.value = 0
    }, 500)
  } catch (e: any) {
    console.error('Scene image upload failed:', e)
    isUploadingSceneImage.value = false
    sceneImageUploadProgress.value = 0
    alert(`Scene image upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
    return
  }

  if (sceneImagePreviewUrl.value) {
    URL.revokeObjectURL(sceneImagePreviewUrl.value)
    sceneImagePreviewUrl.value = null
  }
  if (file) {
    sceneImagePreviewUrl.value = URL.createObjectURL(file)
  }
  showSceneImageHistory.value = false
}

const selectHistoricalSceneImage = (image: HistoricalImage) => {
  sceneImageUrl.value = image.image_url
  sceneImageFile.value = null
  if (sceneImagePreviewUrl.value) {
    URL.revokeObjectURL(sceneImagePreviewUrl.value)
  }
  sceneImagePreviewUrl.value = image.image_url
  showSceneImageHistory.value = false
}

const deleteHistoricalSceneImage = async (image: HistoricalImage, event: Event) => {
  event.stopPropagation() // Prevent selecting the image when clicking delete
  
  if (!confirm('Delete this scene image? This action cannot be undone.')) {
    return
  }
  
  try {
    await apiClient.delete(`/user-images/${image.id}`)
    // Remove from local state
    historicalSceneImages.value = historicalSceneImages.value.filter(img => img.id !== image.id)
    
    // If the deleted image was currently selected, clear the selection
    if (sceneImageUrl.value === image.image_url) {
      sceneImageUrl.value = null
      if (sceneImagePreviewUrl.value === image.image_url) {
        if (sceneImagePreviewUrl.value.startsWith('blob:')) {
          URL.revokeObjectURL(sceneImagePreviewUrl.value)
        }
        sceneImagePreviewUrl.value = null
      }
    }
  } catch (error: any) {
    console.error('Failed to delete scene image:', error)
    alert(`Delete failed: ${error?.response?.data?.detail || error?.message || 'Unknown error'}`)
  }
}

const removeSceneImage = () => {
  if (sceneImagePreviewUrl.value) {
    URL.revokeObjectURL(sceneImagePreviewUrl.value)
    sceneImagePreviewUrl.value = null
  }
  sceneImageFile.value = null
  sceneImageUrl.value = null
}

const performTryOn = async () => {
  // 确保场景图片（如果有）已经上传获得 URL
  if (sceneImageFile.value && !sceneImageUrl.value) {
    try {
      const form = new FormData()
      form.append('file', sceneImageFile.value)
      const resp = await apiClient.post<{ url: string }>('/scene-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      sceneImageUrl.value = resp.data.url
    } catch (e: any) {
      console.error('Scene image upload failed before try-on:', e)
      alert(`Scene image upload failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
      return
    }
  }

  if (!modelImageFile.value && !modelImagePreviewUrl.value) {
    showModelImageError.value = true
    alert('Please upload your model photo first.')
    // Scroll to model image uploader
    setTimeout(() => {
      const modelUploader = document.querySelector('[data-model-uploader]')
      if (modelUploader) {
        modelUploader.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
    return
  }
  if (!activeWardrobeItems.value.length) {
    alert('Please choose an outfit via Apply outfit before trying on.')
    return
  }

  const garmentUrls = activeWardrobeItems.value
    .map((item) => item.url || item.features.path)
    .filter((u): u is string => !!u)

  if (!garmentUrls.length) {
    alert('Some items in this outfit are missing usable image URLs.')
    return
  }

  tryOnImageUrl.value = null
  isTryingOn.value = true
  // Reset favorite state when starting a new try-on
  studioStore.setFavoriteStatus(false, null)

  const tryOnRequestData = {
    person_image: modelImageFile.value?.name || 'file',
    garment_urls: garmentUrls,
    scene_image_url: sceneImageUrl.value || undefined,
  }
  
  console.log('=== Try-On Request (to qwen-image-edit) ===')
  console.log('Request data:', JSON.stringify(tryOnRequestData, null, 2))
  console.log('Garment URLs:', garmentUrls)
  console.log('Scene image URL:', sceneImageUrl.value || 'None')
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
    if (sceneImageUrl.value) {
      formData.append('scene_image_url', sceneImageUrl.value)
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
    // Check if this result is already in favorites (in case user regenerates same result)
    await checkFavoriteStatus()
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


const applyOutfit = async (outfit: AgentOutfit) => {
  try {
    // Ensure uploadedItems is loaded before applying outfit
    // Try to restore from cache first (items are already loaded in Wardrobe page)
    if (uploadedItems.value.length === 0) {
      const restored = restoreItemsFromCache()
      if (!restored) {
        // If cache is empty, items haven't been selected in Wardrobe yet
        // This shouldn't happen if user is applying an outfit, but handle it gracefully
        console.warn('[Apply Outfit] No cached data - items should be selected from Wardrobe first')
        // Don't load from backend - user should select items in Wardrobe first
        alert('Please select items in Wardrobe first before applying an outfit.')
        return
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
    localStorage.removeItem('fashion_rec_selected_items')
    
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
    localStorage.removeItem('fashion_rec_selected_items')

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
      scene_image_url: sceneImageUrl.value || null,
    }
    await apiClient.post('/looks', saveLookData)
  } catch (error) {
    console.error('Failed to auto-save applied outfit:', error)
      // Don't throw - saving to history is optional
    }
  
  // State is automatically persisted by Pinia store
  } catch (error) {
    console.error('[Apply Outfit] Error:', error)
    alert(`Apply outfit failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
  
  // Sync to localStorage so Wardrobe page can reflect the change
  selectedItemIds.value = selectedItemIds.value.filter(id => String(id) !== itemIdStr)
  try {
    localStorage.setItem(
      'fashion_rec_selected_items',
      JSON.stringify(selectedItemIds.value)
    )
    console.log('[removeActiveItem] Updated localStorage, removed item:', itemIdStr)
  } catch (e) {
    console.error('Failed to update localStorage after removing item:', e)
  }
  
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
      scene_image_url: sceneImageUrl.value || undefined,
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

// Helper functions for outfit items
const getMissingItems = (outfit: AgentOutfit): AgentOutfitItem[] => {
  return outfit.items.filter(item => {
    // Item is missing if it has no wardrobe_id or the wardrobe_id doesn't exist in uploadedItems
    if (!item.wardrobe_id) return true
    return !findWardrobeItemById(item.wardrobe_id)
  })
}

const hasAnyWardrobeItem = (outfit: AgentOutfit): boolean => {
  // Check if at least one item in the outfit exists in the wardrobe
  return outfit.items.some(item => {
    if (!item.wardrobe_id) return false
    return !!findWardrobeItemById(item.wardrobe_id)
  })
}

const searchOnGoogle = (description: string) => {
  const searchQuery = encodeURIComponent(description)
  const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`
  window.open(googleSearchUrl, '_blank', 'noopener,noreferrer')
}


</script>

<template>
  <div class="min-h-screen bg-green-50/20 font-sans text-green-900">
    <main class="space-y-8">
      <!-- Describe today & generate outfits -->
      <section class="bg-white p-8 rounded-2xl shadow-sm border border-green-100 flex flex-col gap-4">
        <div>
          <h2 class="text-2xl font-bold mb-2 text-green-800">Tell AI about your day</h2>
          <p class="text-sm text-green-700">
        Describe today’s weather, city, scene, and style preferences; AI will use your wardrobe to create outfits.
          </p>
        </div>
        <div class="flex flex-col gap-4">
          <div class="w-full space-y-3">
            <label class="block text-sm font-medium text-green-700 mb-1">
              Describe today and your style
            </label>
            <!-- Rich input wrapper with integrated image upload -->
            <div class="relative border border-green-200 rounded-xl bg-white transition-all focus-within:border-green-400 focus-within:shadow-md">
              <textarea
                v-model="customPrompt"
                rows="3"
                class="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none border-0 placeholder:text-green-600"
                placeholder="e.g., Minimalist commute vibe, avoid white shoes; or describe your scene and preferences."
              ></textarea>
              
              <!-- Scene image preview area -->
              <div v-if="sceneImagePreviewUrl || isUploadingSceneImage" class="px-4 pb-2">
                <div class="relative inline-block group">
                  <div class="w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">
                    <img 
                      v-if="sceneImagePreviewUrl"
                      :src="sceneImagePreviewUrl" 
                      alt="Scene preview" 
                      class="w-full h-full object-cover"
                    />
                    <!-- Upload progress overlay -->
                    <div
                      v-if="isUploadingSceneImage"
                      class="absolute inset-0 bg-gray-900/50 flex flex-col items-center justify-center"
                    >
                      <div class="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                      <span class="text-white text-xs">{{ sceneImageUploadProgress }}%</span>
                    </div>
                    <!-- Progress bar -->
                    <div
                      v-if="isUploadingSceneImage"
                      class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200"
                    >
                      <div
                        class="h-full bg-blue-500 transition-all duration-300"
                        :style="{ width: `${sceneImageUploadProgress}%` }"
                      ></div>
                    </div>
                  </div>
                  <button
                    v-if="sceneImagePreviewUrl && !isUploadingSceneImage"
                    @click="removeSceneImage"
                    class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                    title="Delete scene image"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <!-- Toolbar with image upload button -->
              <div class="flex items-center justify-between px-4 py-2 border-t border-green-100">
                <div class="flex items-center gap-2">
                  <label
                    for="sceneImageInput"
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-green-600 hover:text-green-900 hover:bg-green-50 cursor-pointer transition-colors"
                    title="Upload a reference scene image"
                  >
                    <Upload class="w-4 h-4" />
                    <span class="text-xs">Upload scene image (optional)</span>
                  </label>
                  <input
                    id="sceneImageInput"
                    type="file"
                    accept="image/*"
                    @change="handleSceneImageChange"
                    class="hidden"
                  />
                  <button
                    @click="showSceneImageHistory = !showSceneImageHistory"
                    class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-green-600 hover:text-green-900 hover:bg-green-50 cursor-pointer transition-colors"
                    title="Pick from scene history"
                  >
                    <Clock class="w-4 h-4" />
                    <span class="text-xs">History</span>
                  </button>
                </div>
                
              </div>
            </div>
            
            <!-- Helper text below input -->
            <p class="text-xs text-green-600 px-1">
              Upload a photo of your environment (office, cafe, outdoors, etc.). AI will use it as the scene reference.
            </p>
            
            <!-- Historical scene images modal -->
            <div
              v-if="showSceneImageHistory"
              class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              @click.self="showSceneImageHistory = false"
            >
              <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                <div class="flex items-center justify-between p-6 border-b border-gray-200">
                  <h3 class="text-lg font-semibold text-green-900">Choose a historical scene image</h3>
                  <button
                    @click="showSceneImageHistory = false"
                    class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                  >
                    <X class="w-5 h-5 text-green-500" />
                  </button>
                </div>
                <div class="flex-1 overflow-y-auto p-6">
                  <div v-if="historicalSceneImages.length === 0" class="text-center py-12 text-green-400">
                    <Clock class="w-12 h-12 mx-auto mb-3 text-green-300" />
                    <p>No historical scene images</p>
                  </div>
                  <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <div
                      v-for="image in historicalSceneImages"
                      :key="image.id"
                      @click="selectHistoricalSceneImage(image)"
                      class="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg"
                    >
                      <img
                        :src="image.image_url"
                        :alt="`Scene image ${image.id}`"
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                      <!-- Delete button -->
                      <button
                        @click.stop="deleteHistoricalSceneImage(image, $event)"
                        class="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg z-10"
                        title="Delete this image"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                      <div class="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-green-700">
                          {{ new Date(image.created_at).toLocaleDateString('en-US') }}
                        </div>
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
              class="bg-green-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg shadow-green-500/20 w-full justify-center sm:w-auto"
            >
              <Wand2 class="w-5 h-5" />
              {{ isGenerating ? 'AI is Thinking...' : 'Generate Outfit' }}
            </button>
            <!-- AI branding and transparency note -->
            <div class="flex items-center gap-2 text-xs text-green-600">
              <span class="font-medium text-green-700">fashion</span>
              <span class="text-green-400">|</span>
              <span>Powered by Qwen</span>
              <span class="text-green-400">|</span>
              <span class="text-green-400">Independent service</span>
            </div>
          </div>
          
          <!-- AI Outfit Plans (moved here from Step 3) -->
          <div v-if="agentOutfits.length && !isGenerating" class="mt-6 space-y-6">
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold">AI Outfit Plans</h3>
                <!-- AI branding and transparency note -->
                
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                  v-for="(outfit, idx) in agentOutfits"
                  :key="idx"
                  class="bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col justify-between"
                >
                  <div>
                    <h4 class="font-semibold text-sm mb-2">{{ outfit.title }}</h4>
                    <ul class="text-xs text-green-700 space-y-1 mb-2">
                      <li v-for="(it, i) in outfit.items" :key="i" class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                          <span class="font-medium capitalize">{{ it.role }}:</span>
                          <span> {{ it.description }}</span>
                          <span v-if="findWardrobeItemById(it.wardrobe_id)" class="text-green-600 ml-1">(in wardrobe)</span>
                          <span v-if="it.wardrobe_id && activeWardrobeIds.includes(String(it.wardrobe_id))" class="text-blue-600 ml-1">(selected)</span>
                        </div>
                        <button
                          v-if="!findWardrobeItemById(it.wardrobe_id)"
                          @click.stop="searchOnGoogle(it.description)"
                          class="flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
                          :title="`Search for ${it.description} on Google`"
                        >
                          <Search class="w-3.5 h-3.5 text-green-600" />
                        </button>
                      </li>
                    </ul>
                    <p class="text-xs text-green-500 mb-2">
                      {{ outfit.reason }}
                    </p>
                    <p class="text-xs text-green-500 whitespace-pre-line">
                      {{ outfit.long_text }}
                    </p>
                  </div>
                  <div class="mt-3 flex flex-col gap-2">
                    <!-- Apply outfit button - only show if at least one item is in wardrobe -->
                    <button
                      v-if="hasAnyWardrobeItem(outfit)"
                      type="button"
                      @click.prevent="applyOutfit(outfit)"
                      class="text-xs px-3 py-1 rounded-full border border-blue-400 text-blue-600 hover:border-blue-600 hover:text-blue-700 transition-colors self-end"
                    >
                      Apply outfit
                    </button>
                    <!-- Google search buttons for missing items -->
                    <div v-if="getMissingItems(outfit).length > 0" class="flex flex-wrap gap-2">
                      <button
                        v-for="(missingItem, idx) in getMissingItems(outfit)"
                        :key="idx"
                        @click.stop="searchOnGoogle(missingItem.description)"
                        class="text-xs px-2 py-1 rounded-full border border-gray-300 text-green-700 hover:border-gray-400 hover:text-green-900 hover:bg-gray-50 transition-colors flex items-center gap-1"
                      >
                        <Search class="w-3 h-3" />
                        <span>Search {{ missingItem.role }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Loading State (only show when actively generating) -->
          <div v-else-if="isGenerating" class="mt-6 py-12 flex flex-col items-center justify-center">
             <div class="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
             <p class="text-green-600 animate-pulse mb-2">Consulting fashion knowledge base...</p>
             
          </div>
        </div>
      </section>

      <!-- Applied Outfit Items - Independent Section -->
      <section class="bg-white p-8 rounded-2xl shadow-sm border border-green-100 flex flex-col gap-4">
        <div>
          <h2 class="text-2xl font-bold mb-2 text-green-800">Applied Outfit Items</h2>
          <p class="text-sm text-green-700">
            Items currently in this outfit. Remove items or generate suggestions for missing roles.
          </p>
        </div>
        
        <div class="p-4 border border-green-100 rounded-xl bg-green-50/50">
          <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-medium text-green-700">
              Applied outfit items ({{ activeWardrobeItems.length }})
            </p>
            <p v-if="getMissingRoles().length > 0" class="text-xs text-green-600">
              {{ getMissingRoles().length }} roles removed; re-generate to fill them.
            </p>
          </div>
          
          <!-- Empty state -->
          <div v-if="activeWardrobeItems.length === 0" class="py-8 text-center">
            <Shirt class="w-12 h-12 mx-auto mb-3 text-green-600" />
            <p class="text-sm text-green-700 mb-2">No items selected yet</p>
            <p class="text-xs text-green-600 mb-4">Go to Wardrobe and add items to the Outfit Generator.</p>
            <button
              @click="$router.push('/wardrobe')"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-green-200 text-green-700 hover:border-green-600 hover:text-green-900 transition-colors"
            >
              <Shirt class="w-4 h-4" />
              Go to Wardrobe
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
                  <div class="w-20 h-20 rounded-lg overflow-hidden border-2 border-green-200 hover:border-green-500 transition-all hover:shadow-lg bg-green-100">
                    <img
                      v-if="item.url || item.features.path"
                      :src="item.url || item.features.path"
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
                  title="删除此单品"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
              <div class="mt-1 text-center">
                <p class="text-xs text-green-700 truncate max-w-[80px]">
                  {{ formatFeatureValue(item.features.color) }} {{ formatFeatureValue(item.features.type) }}
                </p>
                <p v-if="activeWardrobeRoleMap.get(String(item.id))" class="text-xs text-green-600 truncate max-w-[80px]">
                  {{ activeWardrobeRoleMap.get(String(item.id)) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Step 2 moved to dedicated Wardrobe page -->

      <!-- Step 3: Review outfits & virtual try-on -->
      <section class="bg-white p-8 rounded-2xl shadow-sm border border-green-100 flex flex-col gap-8">
        <div>
          <h2 class="text-2xl font-bold mb-2 text-green-800">Review outfits & try on</h2>
        </div>

        <!-- Model photo uploader with integrated empty state -->
        <div 
          data-model-uploader
          :class="[
            'border rounded-xl bg-white transition-all focus-within:shadow-md overflow-hidden',
            showModelImageError 
              ? 'border-red-500 border-2 shadow-red-200' 
              : 'border-gray-200 focus-within:border-gray-400'
          ]"
        >
          <!-- Model photo preview or empty state -->
          <div v-if="modelImagePreviewUrl || isUploadingModelImage" class="p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="text-sm font-medium text-green-700 mb-1">Model photo</p>
                <p class="text-xs text-green-500">
                  Upload a half-body or full-body photo of you. All try-ons will use this model photo.
                </p>
              </div>
              <button
                v-if="modelImagePreviewUrl && !isUploadingModelImage"
                @click="removeModelImage"
                class="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md flex-shrink-0"
                title="Delete model photo"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
            <div class="w-32 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">
              <img 
                v-if="modelImagePreviewUrl"
                :src="modelImagePreviewUrl" 
                alt="Model preview" 
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
              <div
                v-if="isUploadingModelImage"
                class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200"
              >
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
              <!-- Show empty state message only when no results generated -->
              <template v-if="!recommendations.length && !agentOutfits.length && !isGenerating">
                <Wand2 class="w-12 h-12 mx-auto mb-3 text-green-600" />
              </template>
              <div class="flex flex-col items-center gap-3">
                <div class="flex items-center gap-3">
                  <label
                    for="modelImageInput"
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-green-700 border border-green-200 hover:border-green-600 hover:text-green-900 cursor-pointer transition-colors"
                  >
                    <Upload class="w-4 h-4" />
                    <span>Upload new photo</span>
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
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-green-700 border border-green-200 hover:border-green-600 hover:text-green-900 cursor-pointer transition-colors"
                  >
                    <Clock class="w-4 h-4" />
                    <span>History</span>
                  </button>
                </div>
                <p class="text-xs text-green-600">
                  Upload a half-body or full-body photo; all try-ons will use this model photo.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Upload button when photo exists (for replacement) -->
          <div v-if="modelImagePreviewUrl" class="px-4 pb-4 border-t border-gray-100 pt-3">
            <div class="flex items-center gap-2">
              <label
                for="modelImageInputReplace"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-green-600 hover:text-green-900 hover:bg-green-50 cursor-pointer transition-colors"
              >
                <Upload class="w-4 h-4" />
                <span>Replace photo</span>
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
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-green-600 hover:text-green-900 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Clock class="w-4 h-4" />
                <span>History</span>
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
          <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-green-900">Choose a historical model image</h3>
              <button
                @click="showModelImageHistory = false"
                class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X class="w-5 h-5 text-green-500" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto p-6">
              <div v-if="historicalModelImages.length === 0" class="text-center py-12 text-green-400">
                <Clock class="w-12 h-12 mx-auto mb-3 text-green-300" />
                <p>No historical model images</p>
              </div>
              <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <div
                  v-for="image in historicalModelImages"
                  :key="image.id"
                  @click="selectHistoricalModelImage(image)"
                  class="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg"
                >
                  <img
                    :src="image.image_url"
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
                    <div class="bg-white/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-green-700">
                      {{ new Date(image.created_at).toLocaleDateString('en-US') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Try-on controls -->
        <div v-if="activeWardrobeItems.length" class="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
          <div class="flex items-center justify-between mb-3">
            <div>
              <p class="text-sm font-medium text-green-700 mb-1">Ready to try on</p>
              <p class="text-xs text-green-500">
                {{ activeWardrobeItems.length }} items selected. Click below to generate a virtual try-on.
              </p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              @click="performTryOn"
              :disabled="!activeWardrobeItems.length || isTryingOn"
              class="px-4 py-2 rounded-lg border border-green-500 text-green-600 hover:border-green-700 hover:text-green-800 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Wand2 v-if="!isTryingOn" class="w-4 h-4" />
              <div v-else class="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              <span>{{ isTryingOn ? 'Generating try-on...' : 'Try on this outfit' }}</span>
            </button>
           
          </div>
        </div>

        <!-- Try-on Loading State -->
        <div v-if="isTryingOn && !tryOnImageUrl" class="py-12 flex flex-col items-center justify-center border border-green-100 rounded-xl bg-green-50">
          <div class="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p class="text-green-700 animate-pulse mb-2">Generating virtual try-on...</p>
          <!-- AI branding and transparency note (loading) -->
        </div>

        <!-- Recommendations -->
        <div v-if="selectedItem && recommendations.length > 0">
          <h3 class="text-lg font-semibold mb-4">AI Suggestions</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div v-for="rec in recommendations" :key="rec.id" class="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow">
              <div class="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center text-green-400 overflow-hidden">
                <img 
                  v-if="rec.path && rec.path.startsWith('http')" 
                  :src="rec.path" 
                  class="w-full h-full object-cover"
                />
                <span v-else>{{ rec.type }}</span>
              </div>
              <p class="font-medium text-sm">{{ rec.color }} {{ rec.type }}</p>
              <p class="text-xs text-green-500 mt-1">{{ rec.reason }}</p>
              <p class="text-xs text-green-600 mt-1 font-medium">Match: {{ Math.round(rec.score * 100) }}%</p>
            </div>
          </div>
        </div>

        <!-- Try-on Result -->
        <div v-if="tryOnImageUrl" class="border-t border-gray-100 pt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold">Virtual Try-On Result</h3>
            <button
              @click="saveFavorite"
              :disabled="isSavingFavorite"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                favoriteSaved
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-gray-50 text-green-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300',
                isSavingFavorite && 'opacity-50 cursor-not-allowed'
              ]"
            >
              <Heart
                :class="[
                  'w-4 h-4 transition-all',
                  favoriteSaved ? 'fill-current text-green-600' : ''
                ]"
              />
              <span v-if="isSavingFavorite">Saving...</span>
              <span v-else-if="favoriteSaved">Saved</span>
              <span v-else>Favorite</span>
            </button>
          </div>
          <div class="w-full max-w-md mx-auto rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:border-gray-300 transition-colors" @click="openTryOnImageViewer">
            <img :src="tryOnImageUrl" alt="Try-on result" class="w-full object-contain" />
          </div>
        </div>
      </section>
    </main>
    
    <!-- Footer -->
    <footer class="mt-12 pt-8 border-t border-green-200 pb-8">
      <div class="flex justify-center gap-6 text-sm text-green-600">
        <router-link to="/privacy-policy" class="hover:text-green-900 transition-colors">
          Privacy Policy
        </router-link>
        <span class="text-green-300">|</span>
        <router-link to="/terms-of-service" class="hover:text-green-900 transition-colors">
          Terms of Service
        </router-link>
      </div>
      <p class="text-center text-xs text-green-600 mt-4">
        © 2025 Fashion Rec. All rights reserved.
      </p>
    </footer>
    
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
            alt="Outfit item"
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
