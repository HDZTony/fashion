<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, User, Check, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useModelImages, type ModelImage } from '@/composables/useModelImages'
import { apiClient } from '@/lib/api-client'
import { getMediumImageUrl, getLargeImageUrl } from '@/lib/imageOptimizer'
import ImageViewer from '@/components/ImageViewer.vue'

interface ModelProfile {
  nickname: string | null
  height: number | null
  weight: number | null
  birth_year: number | null
}

const { t } = useI18n()
const {
  models,
  allModels,
  activeModelId,
  activeModelUrl,
  isUploading,
  uploadProgress,
  loadModels,
  selectModel,
  replaceModelImage,
} = useModelImages()

function onModelChange(id: unknown) {
  const strId = String(id ?? '')
  if (!strId) return
  selectModel(strId)
}

const activeModel = computed<ModelImage | null>(() => {
  if (!activeModelId.value) return null
  return allModels.value.find(m => m.id === activeModelId.value) ?? null
})

const canReplacePhoto = computed(() => {
  return activeModel.value && !activeModel.value.isExample
})

const nickname = ref<string>('')
const height = ref<string>('')
const weight = ref<string>('')
const birthYear = ref<string>('')
const isSaving = ref(false)

const showImageViewer = ref(false)
const imageViewerImages = ref<string[]>([])
function openModelImageViewer() {
  if (!activeModelUrl.value || isUploading.value) return
  imageViewerImages.value = [activeModelUrl.value]
  showImageViewer.value = true
}
function onImageViewerClose(open: boolean) {
  showImageViewer.value = open
  if (!open) imageViewerImages.value = []
}
const isLoadingProfile = ref(false)
const showSaveSuccess = ref(false)
const saveError = ref<string | null>(null)

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 80 }, (_, i) => currentYear - 15 - i)

function formatModelLabel(model: ModelImage): string {
  if (model.isExample) {
    return model.nickname || `Example - ${model.id.replace('example-', '')}`
  }
  return model.nickname || new Date(model.created_at).toLocaleDateString()
}

function resetFields() {
  nickname.value = ''
  height.value = ''
  weight.value = ''
  birthYear.value = ''
}

async function loadProfile() {
  const model = activeModel.value
  if (!model) { resetFields(); return }
  if (model.isExample) { resetFields(); return }

  isLoadingProfile.value = true
  try {
    const resp = await apiClient.get<{ profile: ModelProfile | null }>(`/model-profile/${model.id}`)
    const profile = resp.data?.profile
    if (profile) {
      nickname.value = profile.nickname ?? ''
      height.value = profile.height != null ? String(profile.height) : ''
      weight.value = profile.weight != null ? String(profile.weight) : ''
      birthYear.value = profile.birth_year != null ? String(profile.birth_year) : ''
    } else {
      resetFields()
    }
  } catch {
    resetFields()
  } finally {
    isLoadingProfile.value = false
  }
}

watch(activeModel, loadProfile, { immediate: true })

onMounted(async () => {
  if (models.value.length === 0) {
    await loadModels()
  }
})

async function saveProfile() {
  const model = activeModel.value
  if (!model || model.isExample) return

  isSaving.value = true
  saveError.value = null
  try {
    await apiClient.put(`/model-profile/${model.id}`, {
      nickname: nickname.value || null,
      height: height.value ? Number(height.value) : null,
      weight: weight.value ? Number(weight.value) : null,
      birth_year: birthYear.value ? Number(birthYear.value) : null,
    })
    await loadModels()
    showSaveSuccess.value = true
    setTimeout(() => { showSaveSuccess.value = false }, 2000)
  } catch (e: any) {
    saveError.value = e?.response?.data?.detail || e.message || t('settings.model.saveFailed')
  } finally {
    isSaving.value = false
  }
}

const fileInputRef = ref<HTMLInputElement | null>(null)

function onReplacePhotoClick() {
  fileInputRef.value?.click()
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !activeModel.value) return
  try {
    await replaceModelImage(activeModel.value.id, file)
  } catch (e: any) {
    console.error('Replace photo failed:', e)
    alert(`Replace failed: ${e?.response?.data?.detail || e.message || 'Unknown error'}`)
  }
  target.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
        {{ t('settings.model.title') }}
      </h1>
      <p class="text-sm text-muted-foreground mb-6">{{ t('settings.model.description') }}</p>

      <!-- Model switcher -->
      <div class="mb-8 space-y-2">
        <label class="text-sm font-medium text-gray-700">{{ t('settings.model.switchModel') }}</label>
        <NativeSelect :model-value="activeModelId ?? ''" @update:model-value="onModelChange" class="w-full h-10 text-sm">
          <NativeSelectOption v-for="m in allModels" :key="m.id" :value="m.id">
            {{ formatModelLabel(m) }}
          </NativeSelectOption>
        </NativeSelect>
      </div>

      <!-- No model selected hint -->
      <div v-if="!activeModel" class="text-center py-16">
        <div class="w-20 h-20 rounded-full bg-pink-50 border-2 border-dashed border-pink-300 flex items-center justify-center mx-auto mb-4">
          <User class="w-8 h-8 text-pink-400" />
        </div>
        <p class="text-muted-foreground">{{ t('settings.model.noModel') }}</p>
      </div>

      <!-- Model form -->
      <div v-else class="space-y-8">
        <!-- Photo section -->
        <div class="bg-white rounded-2xl shadow-sm border border-pink-100 p-6">
          <h2 class="text-base font-semibold text-gray-800 mb-1">{{ t('settings.model.photo') }}</h2>
          <p class="text-xs text-muted-foreground mb-4">{{ t('settings.model.photoDescription') }}</p>

          <div class="flex items-start gap-6">
            <div
              class="w-32 h-44 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0 relative cursor-pointer hover:border-gray-300 transition-colors"
              @click="openModelImageViewer"
            >
              <img
                v-if="activeModelUrl"
                :src="getMediumImageUrl(activeModelUrl)"
                alt="Model photo"
                class="w-full h-full object-cover pointer-events-none"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <User class="w-10 h-10 text-gray-300" />
              </div>
              <div
                v-if="isUploading"
                class="absolute inset-0 bg-black/40 flex flex-col items-center justify-center pointer-events-none"
              >
                <Loader2 class="w-6 h-6 text-white animate-spin mb-1" />
                <span class="text-white text-xs">{{ uploadProgress }}%</span>
              </div>
            </div>
            <div v-if="canReplacePhoto" class="flex flex-col gap-2">
              <Button variant="outline" size="sm" @click="onReplacePhotoClick" :disabled="isUploading">
                <Upload class="w-4 h-4" />
                {{ t('settings.model.replacePhoto') }}
              </Button>
              <p class="text-xs text-muted-foreground">{{ t('settings.model.replacePhotoHint') }}</p>
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onFileChange"
              />
            </div>
          </div>
        </div>

        <!-- Info section -->
        <div class="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 relative">
          <div v-if="isLoadingProfile" class="absolute inset-0 bg-white/60 flex items-center justify-center rounded-2xl z-10">
            <Loader2 class="w-5 h-5 text-pink-500 animate-spin" />
          </div>

          <div class="grid gap-6">
            <!-- Nickname -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">{{ t('settings.model.nickname') }}</label>
              <input
                v-model="nickname"
                type="text"
                maxlength="30"
                :placeholder="t('settings.model.nicknamePlaceholder')"
                class="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-colors"
              />
            </div>

            <!-- Height -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">{{ t('settings.model.height') }}</label>
              <div class="relative">
                <input
                  v-model="height"
                  type="number"
                  min="100"
                  max="250"
                  :placeholder="t('settings.model.heightPlaceholder')"
                  class="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-colors"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
              </div>
            </div>

            <!-- Weight -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">{{ t('settings.model.weight') }}</label>
              <div class="relative">
                <input
                  v-model="weight"
                  type="number"
                  min="30"
                  max="200"
                  :placeholder="t('settings.model.weightPlaceholder')"
                  class="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-colors"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
              </div>
            </div>

            <!-- Birth Year -->
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-700">{{ t('settings.model.birthYear') }}</label>
              <select
                v-model="birthYear"
                class="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-colors"
              >
                <option value="">{{ t('settings.model.birthYearPlaceholder') }}</option>
                <option v-for="year in yearOptions" :key="year" :value="String(year)">{{ year }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Save button + error -->
        <div class="flex items-center gap-3">
          <Button @click="saveProfile" :disabled="isSaving || isLoadingProfile" class="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white">
            <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
            <Check v-else-if="showSaveSuccess" class="w-4 h-4" />
            {{ isSaving ? t('settings.model.saving') : (showSaveSuccess ? t('settings.model.saveSuccess') : t('settings.model.save')) }}
          </Button>
          <span v-if="saveError" class="text-sm text-red-500">{{ saveError }}</span>
        </div>
      </div>
    </div>
  </div>

  <ImageViewer
    :open="showImageViewer"
    :images="imageViewerImages"
    :resolve-url="getLargeImageUrl"
    @update:open="onImageViewerClose"
  />
</template>
