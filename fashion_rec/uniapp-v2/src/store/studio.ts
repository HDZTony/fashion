import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AgentOutfit, Item } from '@fashion-rec/shared'

const uniStorage = {
  getItem: (key: string) => {
    try {
      return uni.getStorageSync(key) ?? null
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      uni.setStorageSync(key, value)
    } catch (_) {}
  },
  removeItem: (key: string) => {
    try {
      uni.removeStorageSync(key)
    } catch (_) {}
  },
}

const STORE_KEY = 'studio-store'

function loadState() {
  const raw = uniStorage.getItem(STORE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function saveState(state: Record<string, unknown>) {
  uniStorage.setItem(STORE_KEY, JSON.stringify(state))
}

export const useStudioStore = defineStore('studio', () => {
  const customPrompt = ref('')
  const backgroundImageUrl = ref<string | null>(null)
  const backgroundImagePreviewUrl = ref<string | null>(null)
  const backgroundActionPrompt = ref('')
  const modelImagePreviewUrl = ref<string | null>(null)
  const tryOnImageUrl = ref<string | null>(null)
  const agentOutfits = ref<AgentOutfit[]>([])
  const activeWardrobeIds = ref<string[]>([])
  const selectedItemIds = ref<string[]>([])
  const uploadedItems = ref<Item[]>([])
  const activeWardrobeRoleMapEntries = ref<[string, string][]>([])
  const originalAppliedOutfit = ref<AgentOutfit | null>(null)
  const favoriteSaved = ref(false)
  const currentFavoriteId = ref<string | null>(null)
  const backgroundTabValue = ref('no-background')

  const getActiveWardrobeRoleMap = () => new Map<string, string>(activeWardrobeRoleMapEntries.value)
  const setActiveWardrobeRoleMap = (map: Map<string, string>) => {
    activeWardrobeRoleMapEntries.value = Array.from(map.entries())
  }

  const activeWardrobeItems = computed(() =>
    activeWardrobeIds.value
      .map((id) => uploadedItems.value.find((it) => String(it.id) === id) ?? null)
      .filter((it): it is Item => it !== null)
  )
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
    () => activeWardrobeItems.value.length > 0 || unmatchedOutfitDescriptions.value.length > 0
  )

  const clearState = () => {
    customPrompt.value = ''
    backgroundImageUrl.value = null
    backgroundImagePreviewUrl.value = null
    backgroundActionPrompt.value = ''
    modelImagePreviewUrl.value = null
    tryOnImageUrl.value = null
    uploadedItems.value = []
    agentOutfits.value = []
    activeWardrobeIds.value = []
    selectedItemIds.value = []
    activeWardrobeRoleMapEntries.value = []
    originalAppliedOutfit.value = null
    favoriteSaved.value = false
    currentFavoriteId.value = null
    backgroundTabValue.value = 'no-background'
    uniStorage.removeItem(STORE_KEY)
  }

  const persist = () => {
    saveState({
      customPrompt: customPrompt.value,
      backgroundImageUrl: backgroundImageUrl.value,
      backgroundImagePreviewUrl: backgroundImagePreviewUrl.value,
      backgroundActionPrompt: backgroundActionPrompt.value,
      modelImagePreviewUrl: modelImagePreviewUrl.value,
      tryOnImageUrl: tryOnImageUrl.value,
      agentOutfits: agentOutfits.value,
      activeWardrobeIds: activeWardrobeIds.value,
      selectedItemIds: selectedItemIds.value,
      uploadedItems: uploadedItems.value,
      activeWardrobeRoleMapEntries: activeWardrobeRoleMapEntries.value,
      originalAppliedOutfit: originalAppliedOutfit.value,
      favoriteSaved: favoriteSaved.value,
      currentFavoriteId: currentFavoriteId.value,
      backgroundTabValue: backgroundTabValue.value,
    })
  }

  const hydrate = () => {
    const s = loadState()
    if (!s) return
    if (s.customPrompt != null) customPrompt.value = s.customPrompt as string
    if (s.backgroundImageUrl != null) backgroundImageUrl.value = s.backgroundImageUrl as string | null
    if (s.backgroundImagePreviewUrl != null) backgroundImagePreviewUrl.value = s.backgroundImagePreviewUrl as string | null
    if (s.backgroundActionPrompt != null) backgroundActionPrompt.value = s.backgroundActionPrompt as string
    if (s.modelImagePreviewUrl != null) modelImagePreviewUrl.value = s.modelImagePreviewUrl as string | null
    if (s.tryOnImageUrl != null) tryOnImageUrl.value = s.tryOnImageUrl as string | null
    if (Array.isArray(s.agentOutfits)) agentOutfits.value = s.agentOutfits as AgentOutfit[]
    if (Array.isArray(s.activeWardrobeIds)) activeWardrobeIds.value = s.activeWardrobeIds as string[]
    if (Array.isArray(s.selectedItemIds)) selectedItemIds.value = s.selectedItemIds as string[]
    if (Array.isArray(s.uploadedItems)) uploadedItems.value = s.uploadedItems as Item[]
    if (Array.isArray(s.activeWardrobeRoleMapEntries)) activeWardrobeRoleMapEntries.value = s.activeWardrobeRoleMapEntries as [string, string][]
    if (s.originalAppliedOutfit != null) originalAppliedOutfit.value = s.originalAppliedOutfit as AgentOutfit | null
    if (s.favoriteSaved != null) favoriteSaved.value = s.favoriteSaved as boolean
    if (s.currentFavoriteId != null) currentFavoriteId.value = s.currentFavoriteId as string | null
    if (s.backgroundTabValue != null) backgroundTabValue.value = s.backgroundTabValue as string
  }

  const setFavoriteStatus = (saved: boolean, id: string | null = null) => {
    favoriteSaved.value = saved
    currentFavoriteId.value = id
  }

  return {
    customPrompt,
    backgroundImageUrl,
    backgroundImagePreviewUrl,
    backgroundActionPrompt,
    modelImagePreviewUrl,
    tryOnImageUrl,
    agentOutfits,
    activeWardrobeIds,
    selectedItemIds,
    uploadedItems,
    activeWardrobeRoleMapEntries,
    originalAppliedOutfit,
    favoriteSaved,
    currentFavoriteId,
    backgroundTabValue,
    activeWardrobeItems,
    unmatchedOutfitDescriptions,
    hasTryOnInput,
    getActiveWardrobeRoleMap,
    setActiveWardrobeRoleMap,
    clearState,
    persist,
    hydrate,
    setFavoriteStatus,
  }
})
