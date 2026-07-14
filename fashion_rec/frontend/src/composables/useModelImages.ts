import { ref, computed } from 'vue'
import { apiClient, longUploadApiClient } from '@/lib/api-client'
import { useStudioStore } from '@/stores/studio'
import { useAuthStore } from '@/stores/auth'

export interface ModelImage {
  id: string
  image_url: string
  image_type: 'background' | 'model'
  created_at: string
  isExample?: boolean
  nickname?: string
}

/** Used for ChatKit / try-on when no model is selected (keep in sync with backend `chatkit_tools`). */
export const DEFAULT_MODEL_IMAGE_URL = 'https://r2.fashion-rec.com/example/IMG_9953.JPG'

const EXAMPLE_MODEL_IMAGES: ModelImage[] = [
  {
    id: 'example-IMG_9953',
    image_url: DEFAULT_MODEL_IMAGE_URL,
    image_type: 'model',
    created_at: '2025-01-01T00:00:00Z',
    isExample: true,
    nickname: 'Example 1',
  },
  {
    id: 'example-IMG_9954',
    image_url: 'https://r2.fashion-rec.com/example/IMG_9954.JPG',
    image_type: 'model',
    created_at: '2025-01-01T00:00:00Z',
    isExample: true,
    nickname: 'Example 2',
  },
]

const models = ref<ModelImage[]>([])
const isUploading = ref(false)
const uploadProgress = ref(0)

export function useModelImages() {
  const studioStore = useStudioStore()
  const authStore = useAuthStore()

  const isAuthenticated = computed(() => authStore.isAuthenticated)

  /** Currently selected model ID (single source of truth in store) */
  const activeModelId = computed(() => studioStore.activeModelId)

  /** User-uploaded + example models in one flat list */
  const allModels = computed<ModelImage[]>(() => [
    ...models.value,
    ...EXAMPLE_MODEL_IMAGES,
  ])

  /** Derive URL from the active model ID + model list */
  const activeModelUrl = computed<string | null>(() => {
    const id = studioStore.activeModelId
    if (!id) return null
    const found = allModels.value.find(m => m.id === id)
    return found?.image_url ?? null
  })

  /** For API context (e.g. Studio chat): selected model, else built-in default — never omit. */
  const modelImageUrlForChatContext = computed(() => {
    const u = activeModelUrl.value?.trim()
    if (u) return u
    return DEFAULT_MODEL_IMAGE_URL
  })

  async function loadModels(): Promise<void> {
    if (!isAuthenticated.value) return
    try {
      const [imagesResp, profilesResp] = await Promise.all([
        apiClient.get<{ images: ModelImage[] }>('/user-images?image_type=model'),
        apiClient.get<{ profiles: { model_id: string; nickname: string | null }[] }>('/model-profiles').catch(() => ({ data: { profiles: [] } })),
      ])
      const images: ModelImage[] = Array.isArray(imagesResp.data?.images || imagesResp.data)
        ? (imagesResp.data?.images || imagesResp.data)
        : []
      const nicknameMap = new Map(
        (profilesResp.data?.profiles ?? []).map(p => [p.model_id, p.nickname]),
      )
      models.value = images.map(img => ({
        ...img,
        nickname: nicknameMap.get(img.id) ?? undefined,
      }))
    } catch (error) {
      console.error('[useModelImages] Failed to load models:', error)
    }
  }

  /**
   * Upload a model image, refresh the model list, and auto-select it.
   * Returns the new model's ID.
   */
  async function uploadModelImage(file: File): Promise<string> {
    isUploading.value = true
    uploadProgress.value = 0

    const formData = new FormData()
    formData.append('file', file)

    let hasRealProgress = false
    const progressInterval = setInterval(() => {
      if (!hasRealProgress && uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 200)

    try {
      const resp = await longUploadApiClient.post<{ url: string }>('/model-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          hasRealProgress = true
          if (progressEvent.total) {
            uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          } else if (progressEvent.loaded) {
            uploadProgress.value = Math.min(90, Math.round((progressEvent.loaded / file.size) * 100))
          }
        },
      })

      clearInterval(progressInterval)
      uploadProgress.value = 100

      const url = resp.data.url
      await loadModels()

      const newModel = models.value.find(m => m.image_url === url)
      const newId = newModel?.id ?? ''
      if (newId) {
        selectModel(newId)
      }

      setTimeout(() => {
        isUploading.value = false
        uploadProgress.value = 0
      }, 500)

      return newId
    } catch (e: any) {
      clearInterval(progressInterval)
      isUploading.value = false
      uploadProgress.value = 0
      throw e
    }
  }

  /**
   * Replace an existing model's photo. The model keeps its ID;
   * only the image_url changes in the database.
   */
  async function replaceModelImage(modelId: string, file: File): Promise<string> {
    isUploading.value = true
    uploadProgress.value = 0

    const formData = new FormData()
    formData.append('file', file)

    let hasRealProgress = false
    const progressInterval = setInterval(() => {
      if (!hasRealProgress && uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 200)

    try {
      const resp = await longUploadApiClient.put<{ url: string }>(`/model-image/${modelId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          hasRealProgress = true
          if (progressEvent.total) {
            uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          } else if (progressEvent.loaded) {
            uploadProgress.value = Math.min(90, Math.round((progressEvent.loaded / file.size) * 100))
          }
        },
      })

      clearInterval(progressInterval)
      uploadProgress.value = 100

      await loadModels()

      setTimeout(() => {
        isUploading.value = false
        uploadProgress.value = 0
      }, 500)

      return resp.data.url
    } catch (e: any) {
      clearInterval(progressInterval)
      isUploading.value = false
      uploadProgress.value = 0
      throw e
    }
  }

  async function deleteModel(id: string): Promise<void> {
    await apiClient.delete(`/user-images/${id}`)
    models.value = models.value.filter(m => m.id !== id)

    if (studioStore.activeModelId === id) {
      studioStore.setActiveModelId(null)
    }
  }

  /** Select a model by its ID */
  function selectModel(id: string): void {
    studioStore.setActiveModelId(id)
  }

  /** Find model ID by its image URL (for history restoration, etc.) */
  function findModelIdByUrl(url: string): string | null {
    const found = allModels.value.find(m => m.image_url === url)
    return found?.id ?? null
  }

  function clearActiveModel(): void {
    studioStore.setActiveModelId(null)
  }

  return {
    models,
    allModels,
    isUploading,
    uploadProgress,
    activeModelId,
    activeModelUrl,
    modelImageUrlForChatContext,
    exampleModelImages: EXAMPLE_MODEL_IMAGES,
    loadModels,
    uploadModelImage,
    replaceModelImage,
    deleteModel,
    selectModel,
    findModelIdByUrl,
    clearActiveModel,
  }
}
