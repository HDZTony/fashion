import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AgentOutfit, Item } from '@/types'

const DEFAULT_MODEL_SCOPE_ID = 'example-IMG_9953'

type ModelScopedStudioState = {
  customPrompt: string
  backgroundImageUrl: string | null
  backgroundImagePreviewUrl: string | null
  backgroundActionPrompt: string
  tryOnImageUrl: string | null
  selectedItemIds: string[]
  uploadedItems: Item[]
  agentOutfits: AgentOutfit[]
  activeWardrobeIds: string[]
  activeWardrobeRoleMapEntries: [string, string][]
  originalAppliedOutfit: AgentOutfit | null
  favoriteSaved: boolean
  currentFavoriteId: string | null
  backgroundTabValue: string
}

export const useStudioStore = defineStore('studio', () => {
  // State that should be persisted across page navigation
  const customPrompt = ref('')
  const backgroundImageUrl = ref<string | null>(null)
  const backgroundImagePreviewUrl = ref<string | null>(null)
  const backgroundActionPrompt = ref<string>('')
  const activeModelId = ref<string | null>(null)
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
  const selectedModel = ref<'qwen' | 'grok'>('qwen')
  const modelScopedState = ref<Record<string, ModelScopedStudioState>>({})

  const modelScopeKey = (id: string | null) => {
    const t = (id || '').trim()
    return t || DEFAULT_MODEL_SCOPE_ID
  }

  const snapshotCurrentModelScope = () => {
    const key = modelScopeKey(activeModelId.value)
    modelScopedState.value[key] = {
      customPrompt: customPrompt.value,
      backgroundImageUrl: backgroundImageUrl.value,
      backgroundImagePreviewUrl: backgroundImagePreviewUrl.value,
      backgroundActionPrompt: backgroundActionPrompt.value,
      tryOnImageUrl: tryOnImageUrl.value,
      selectedItemIds: [...selectedItemIds.value],
      uploadedItems: [...uploadedItems.value],
      agentOutfits: [...agentOutfits.value],
      activeWardrobeIds: [...activeWardrobeIds.value],
      activeWardrobeRoleMapEntries: [...activeWardrobeRoleMapEntries.value],
      originalAppliedOutfit: originalAppliedOutfit.value,
      favoriteSaved: favoriteSaved.value,
      currentFavoriteId: currentFavoriteId.value,
      backgroundTabValue: backgroundTabValue.value,
    }
  }

  const hydrateModelScopeState = (id: string | null) => {
    const key = modelScopeKey(id)
    const scoped = modelScopedState.value[key]
    if (!scoped) {
      customPrompt.value = ''
      backgroundImageUrl.value = null
      backgroundImagePreviewUrl.value = null
      backgroundActionPrompt.value = ''
      tryOnImageUrl.value = null
      selectedItemIds.value = []
      uploadedItems.value = []
      agentOutfits.value = []
      activeWardrobeIds.value = []
      activeWardrobeRoleMapEntries.value = []
      originalAppliedOutfit.value = null
      favoriteSaved.value = false
      currentFavoriteId.value = null
      backgroundTabValue.value = 'no-background'
      return
    }
    customPrompt.value = scoped.customPrompt
    backgroundImageUrl.value = scoped.backgroundImageUrl
    backgroundImagePreviewUrl.value = scoped.backgroundImagePreviewUrl
    backgroundActionPrompt.value = scoped.backgroundActionPrompt
    tryOnImageUrl.value = scoped.tryOnImageUrl
    selectedItemIds.value = [...scoped.selectedItemIds]
    uploadedItems.value = [...scoped.uploadedItems]
    agentOutfits.value = [...scoped.agentOutfits]
    activeWardrobeIds.value = [...scoped.activeWardrobeIds]
    activeWardrobeRoleMapEntries.value = [...scoped.activeWardrobeRoleMapEntries]
    originalAppliedOutfit.value = scoped.originalAppliedOutfit
    favoriteSaved.value = scoped.favoriteSaved
    currentFavoriteId.value = scoped.currentFavoriteId
    backgroundTabValue.value = scoped.backgroundTabValue
  }

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

  const setActiveModelId = (id: string | null) => {
    const nextId = id?.trim() || null
    if (nextId === activeModelId.value)
      return
    snapshotCurrentModelScope()
    activeModelId.value = nextId
    hydrateModelScopeState(nextId)
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

  const setSelectedModel = (value: 'qwen' | 'grok') => {
    selectedModel.value = value
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
    if (!activeModelId.value) return 1
    if (!hasTryOnInput.value) return 2
    return 3
  })
  const step1Completed = computed(() => !!activeModelId.value)
  const step2Completed = computed(() => hasTryOnInput.value)
  const step3Completed = computed(() => !!tryOnImageUrl.value)

  const clearState = () => {
    customPrompt.value = ''
    backgroundImageUrl.value = null
    backgroundImagePreviewUrl.value = null
    backgroundActionPrompt.value = ''
    activeModelId.value = null
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
    selectedModel.value = 'qwen'
    modelScopedState.value = {}
  }

  return {
    // State
    customPrompt,
    backgroundImageUrl,
    backgroundImagePreviewUrl,
    backgroundActionPrompt,
    activeModelId,
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
    selectedModel,
    // Stepper (for layout)
    stepperStep,
    step1Completed,
    step2Completed,
    step3Completed,
    activeWardrobeItems,
    // Helpers
    getActiveWardrobeRoleMap,
    setActiveWardrobeRoleMap,
    // Actions
    setCustomPrompt,
    setBackgroundImage,
    setBackgroundActionPrompt,
    setActiveModelId,
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
    setSelectedModel,
    clearState,
  }
}, {
  // Persist to sessionStorage (page-level persistence)
  persist: typeof window !== 'undefined' ? {
    key: 'studio-store',
    storage: sessionStorage,
  } : false,
})

