import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AgentOutfit, Item } from '@/types'

export const useStudioStore = defineStore('studio', () => {
  // State that should be persisted across page navigation
  const customPrompt = ref('')
  const backgroundImageUrl = ref<string | null>(null)
  const backgroundImagePreviewUrl = ref<string | null>(null)
  const backgroundActionPrompt = ref<string>('')
  const modelImagePreviewUrl = ref<string | null>(null)
  const tryOnImageUrl = ref<string | null>(null)
  const agentOutfits = ref<AgentOutfit[]>([])
  const activeWardrobeIds = ref<string[]>([])
  const selectedItemIds = ref<string[]>([])
  const uploadedItems = ref<Item[]>([])
  // Store role mapping as array of [id, role] tuples for serialization
  const activeWardrobeRoleMapEntries = ref<[string, string][]>([])
  const originalAppliedOutfit = ref<AgentOutfit | null>(null)
  const favoriteSaved = ref(false)
  const currentFavoriteId = ref<string | null>(null)
  const backgroundTabValue = ref<string>('no-background')

  // Helper to convert role map entries to Map
  const getActiveWardrobeRoleMap = () => {
    return new Map<string, string>(activeWardrobeRoleMapEntries.value)
  }

  // Helper to set role map from Map
  const setActiveWardrobeRoleMap = (map: Map<string, string>) => {
    activeWardrobeRoleMapEntries.value = Array.from(map.entries())
  }

  // Actions
  const setCustomPrompt = (prompt: string) => {
    customPrompt.value = prompt
  }

  const setBackgroundImage = (url: string | null, previewUrl: string | null = null) => {
    backgroundImageUrl.value = url
    backgroundImagePreviewUrl.value = previewUrl || url
  }

  const setBackgroundActionPrompt = (prompt: string) => {
    backgroundActionPrompt.value = prompt
  }

  const setModelImage = (url: string | null) => {
    modelImagePreviewUrl.value = url
  }

  const setTryOnImage = (url: string | null) => {
    tryOnImageUrl.value = url
  }

  const setUploadedItems = (items: Item[]) => {
    uploadedItems.value = items
  }

  const setAgentOutfits = (outfits: AgentOutfit[]) => {
    agentOutfits.value = outfits
  }

  const setActiveWardrobeIds = (ids: string[]) => {
    activeWardrobeIds.value = ids
  }

  const setSelectedItemIds = (ids: string[]) => {
    selectedItemIds.value = ids
  }

  const addSelectedItemId = (id: string) => {
    const strId = String(id)
    if (!selectedItemIds.value.includes(strId)) {
      selectedItemIds.value = [...selectedItemIds.value, strId]
    }
  }

  const removeSelectedItemId = (id: string) => {
    const strId = String(id)
    selectedItemIds.value = selectedItemIds.value.filter((i) => i !== strId)
  }

  const addActiveWardrobeId = (id: string) => {
    if (!activeWardrobeIds.value.includes(id)) {
      activeWardrobeIds.value.push(id)
    }
  }

  const removeActiveWardrobeId = (id: string) => {
    activeWardrobeIds.value = activeWardrobeIds.value.filter(i => i !== id)
  }

  const setOriginalAppliedOutfit = (outfit: AgentOutfit | null) => {
    originalAppliedOutfit.value = outfit
  }

  const setFavoriteStatus = (saved: boolean, id: string | null = null) => {
    favoriteSaved.value = saved
    currentFavoriteId.value = id
  }

  const setBackgroundTabValue = (value: string) => {
    backgroundTabValue.value = value
  }

  // Stepper getters (for layout nav: try-on flow progress)
  const activeWardrobeItems = computed(() =>
    activeWardrobeIds.value
      .map((id) => uploadedItems.value.find((it) => String(it.id) === id) ?? null)
      .filter((it): it is Item => it !== null),
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
    () => activeWardrobeItems.value.length > 0 || unmatchedOutfitDescriptions.value.length > 0,
  )
  const stepperStep = computed(() => {
    if (!modelImagePreviewUrl.value) return 1
    if (!hasTryOnInput.value) return 2
    return 3
  })
  const step1Completed = computed(() => !!modelImagePreviewUrl.value)
  const step2Completed = computed(() => hasTryOnInput.value)
  const step3Completed = computed(() => !!tryOnImageUrl.value)

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
  }

  return {
    // State
    customPrompt,
    backgroundImageUrl,
    backgroundImagePreviewUrl,
    backgroundActionPrompt,
    modelImagePreviewUrl,
    tryOnImageUrl,
    selectedItemIds,
    uploadedItems,
    agentOutfits,
    activeWardrobeIds,
    activeWardrobeRoleMapEntries,
    originalAppliedOutfit,
    favoriteSaved,
    currentFavoriteId,
    backgroundTabValue,
    // Stepper (for layout)
    stepperStep,
    step1Completed,
    step2Completed,
    step3Completed,
    // Helpers
    getActiveWardrobeRoleMap,
    setActiveWardrobeRoleMap,
    // Actions
    setCustomPrompt,
    setBackgroundImage,
    setBackgroundActionPrompt,
    setModelImage,
    setTryOnImage,
    setSelectedItemIds,
    addSelectedItemId,
    removeSelectedItemId,
    setUploadedItems,
    setAgentOutfits,
    setActiveWardrobeIds,
    addActiveWardrobeId,
    removeActiveWardrobeId,
    setOriginalAppliedOutfit,
    setFavoriteStatus,
    setBackgroundTabValue,
    clearState,
  }
}, {
  // Persist to sessionStorage (page-level persistence)
  persist: typeof window !== 'undefined' ? {
    key: 'studio-store',
    storage: sessionStorage,
  } : false,
})

