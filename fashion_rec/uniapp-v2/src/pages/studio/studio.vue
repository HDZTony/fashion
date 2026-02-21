<template>
  <scroll-view scroll-y class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50" @scrolltolower="() => {}">
    <view class="p-6 pb-32">
      <!-- Step indicator -->
      <view class="flex gap-6 mb-6 text-sm">
        <view :class="['text-gray-400', step1Done ? 'text-pink-600 font-bold' : '']">1 {{ t('studio.modelPhoto.title') }}</view>
        <view :class="['text-gray-400', step2Done ? 'text-pink-600 font-bold' : '']">2 {{ t('studio.stepper.step2Title') }}</view>
        <view :class="['text-gray-400', step3Done ? 'text-pink-600 font-bold' : '']">3 {{ t('studio.stepper.step3Title') }}</view>
      </view>

      <!-- Model photo section -->
      <view class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.modelPhoto.title') }}</text>
        <view v-if="activeModelUrl || isUploadingModel" class="modelPreview">
          <image v-if="activeModelUrl" :src="getMediumImageUrl(activeModelUrl)" class="modelImg" mode="aspectFill" />
          <view v-if="isUploadingModel" class="uploadOverlay">
            <text class="uploadPercent">{{ modelUploadProgress }}%</text>
          </view>
          <view class="modelActions">
            <button size="mini" @click="chooseModelImage">↑ {{ t('studio.modelPhoto.replacePhoto') }}</button>
            <button v-if="historicalModelImages.length" size="mini" @click="showModelHistory = true">🕐 {{ t('studio.modelPhoto.history') }}</button>
            <button size="mini" @click="showExampleModel = true">{{ t('studio.example') }}</button>
            <button size="mini" class="btnDel" @click="removeModelImage">✕</button>
          </view>
        </view>
        <view v-else class="modelEmpty">
          <text class="emptyIcon">✨</text>
          <view class="modelActions">
            <button size="mini" @click="chooseModelImage">↑ {{ t('studio.modelPhoto.uploadNewPhoto') }}</button>
            <button v-if="historicalModelImages.length" size="mini" @click="showModelHistory = true">🕐 {{ t('studio.modelPhoto.history') }}</button>
            <button size="mini" @click="showExampleModel = true">{{ t('studio.example') }}</button>
          </view>
          <text class="emptyDesc">{{ t('studio.modelPhoto.description') }}</text>
        </view>
      </view>

      <!-- Generate outfit section -->
      <view class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.tellAIAboutDay') }}</text>
        <view class="flex gap-4 mb-4">
          <view :class="['py-4 px-6 rounded-xl text-sm', store.backgroundTabValue === 'no-background' ? 'bg-pink-100 text-pink-600' : 'bg-gray-100']" @click="store.backgroundTabValue = 'no-background'">{{ t('studio.noBackgroundImage') }}</view>
          <view :class="['py-4 px-6 rounded-xl text-sm', store.backgroundTabValue === 'with-background' ? 'bg-pink-100 text-pink-600' : 'bg-gray-100']" @click="store.backgroundTabValue = 'with-background'">{{ t('studio.withBackgroundImage') }}</view>
        </view>
        <view v-if="store.backgroundTabValue === 'with-background'" class="bgSection">
          <textarea v-model="store.backgroundActionPrompt" :placeholder="t('studio.backgroundActionPromptPlaceholder')" class="textarea" rows="2" />
          <view class="bgPreview" v-if="store.backgroundImagePreviewUrl || isUploadingBg">
            <image v-if="store.backgroundImagePreviewUrl" :src="getSmallImageUrl(store.backgroundImagePreviewUrl)" class="bgThumb" mode="aspectFill" />
            <button size="mini" class="btnDel" v-if="store.backgroundImagePreviewUrl && !isUploadingBg" @click="removeBackgroundImage">✕</button>
          </view>
          <view class="row">
            <button size="mini" @click="chooseBackgroundImage">↑ {{ t('studio.uploadBackgroundImage') }}</button>
            <button size="mini" @click="showBgHistory = true">🕐 {{ t('studio.viewHistory') }}</button>
            <button size="mini" @click="showExampleBg = true">{{ t('studio.example') }}</button>
          </view>
        </view>
        <textarea v-model="store.customPrompt" :placeholder="t('studio.promptPlaceholder')" class="w-full p-5 border border-pink-100 rounded-2xl text-sm box-border mt-4" rows="3" />
        <view class="flex gap-3 mt-4 items-center">
          <button class="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white py-6 rounded-2xl text-base disabled:opacity-50" :disabled="isGenerating" @click="getRecommendations">
            {{ isGenerating ? t('studio.aiThinking') : t('studio.generateOutfit') }} ✨
          </button>
          <!-- #ifdef H5 -->
          <select v-model="store.selectedModel" class="model-select">
            <option value="qwen">Qwen</option>
            <option value="grok">Grok</option>
          </select>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <picker :range="modelOptions" :range-key="'label'" :value="modelPickerIndex" @change="onModelPickerChange">
            <view class="model-select-app">{{ modelDisplayLabel }}</view>
          </picker>
          <!-- #endif -->
        </view>
        <text class="branding">fashion | Powered by {{ store.selectedModel === 'grok' ? 'Grok' : 'Qwen' }} | Independent service</text>

        <!-- AI Outfit plans carousel -->
        <view v-if="store.agentOutfits.length && !isGenerating" class="outfitPlans">
          <text class="planTitle">{{ t('studio.outfitPlans.title') }}</text>
          <scroll-view scroll-x class="outfitScroll">
            <view v-for="(outfit, idx) in store.agentOutfits" :key="idx" class="outfitCard">
              <text class="outfitTitle">{{ outfit.title }}</text>
              <text class="outfitReason">{{ outfit.reason }}</text>
              <view v-for="(it, i) in outfit.items" :key="i" class="outfitItem">
                <text class="role">{{ translateRole(it.role) }}: {{ it.description }}</text>
              </view>
              <button size="mini" :class="appliedIdx === idx ? 'applied' : ''" :disabled="applyingIdx !== null" @click="applyOutfit(outfit, idx)">
                {{ applyingIdx === idx ? t('studio.outfitPlans.applying') : appliedIdx === idx ? t('studio.outfitPlans.applied') : t('studio.outfitPlans.applyOutfit') }}
              </button>
            </view>
          </scroll-view>
        </view>
        <view v-if="isGenerating" class="loadingBlock">
          <text class="loadingText">{{ t('studio.consultingKnowledgeBase') }}</text>
        </view>
      </view>

      <!-- Applied outfit items -->
      <view class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.appliedOutfitItems.title') }}</text>
        <text class="text-sm text-gray-500 block mb-4">{{ t('studio.appliedOutfitItems.description') }}</text>
        <view class="appliedCount">{{ t('studio.appliedOutfitItems.itemsCount', { count: store.activeWardrobeItems.length }) }}</view>
        <view v-if="store.activeWardrobeItems.length === 0" class="emptyApplied">
          <text class="emptyIcon">👕</text>
          <text>{{ t('studio.appliedOutfitItems.noItemsSelected') }}</text>
          <text class="hint">{{ t('studio.appliedOutfitItems.goToWardrobePrompt') }}</text>
          <button size="mini" @click="goToWardrobe">{{ t('studio.appliedOutfitItems.goToWardrobe') }}</button>
        </view>
        <view v-else class="appliedGrid">
          <view v-for="(item, idx) in store.activeWardrobeItems" :key="item.id" class="appliedItem">
            <image :src="getSmallImageUrl(item.url || item.features.path)" class="itemThumb" mode="aspectFill" @click="previewImage(getSmallImageUrl(item.url || item.features.path))" />
            <button class="delBtn" @click.stop="removeActiveItem(String(item.id))">✕</button>
            <text class="itemLabel">{{ formatFeature(item.features.color) }} {{ formatFeature(item.features.type) }}</text>
          </view>
        </view>
      </view>

      <!-- Try-on section -->
      <view class="bg-white rounded-2xl p-6 mb-6 border border-pink-100">
        <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block mb-4">{{ t('studio.reviewOutfits') }}</text>
        <view v-if="store.hasTryOnInput" class="tryOnCtrl">
          <text class="hint">{{ t('studio.readyToTryOn') }}</text>
          <button class="btnTryOn" :disabled="isTryingOn" @click="performTryOn">
            {{ isTryingOn ? t('studio.generatingTryOn') : t('studio.tryOnThisOutfit') }} ✨
          </button>
        </view>
        <view v-if="isTryingOn && !store.tryOnImageUrl" class="loadingBlock">
          <text class="loadingText">{{ t('studio.generatingVirtualTryOn') }}</text>
        </view>
        <view v-if="store.tryOnImageUrl" class="tryOnResult">
          <view class="resultHeader">
            <text class="resultTitle">{{ t('studio.virtualTryOn.title') }}</text>
            <button size="mini" :class="store.favoriteSaved ? 'saved' : ''" :disabled="isSavingFavorite" @click="saveFavorite">
              {{ isSavingFavorite ? t('studio.virtualTryOn.saving') : store.favoriteSaved ? t('studio.virtualTryOn.saved') : t('studio.virtualTryOn.favorite') }} ❤
            </button>
          </view>
          <image :src="getLargeImageUrl(store.tryOnImageUrl)" class="resultImg" mode="widthFix" @click="previewImage(store.tryOnImageUrl!)" />
        </view>
      </view>
    </view>

    <!-- Modals -->
    <view v-if="showModelHistory" class="modal" @click.self="showModelHistory = false">
      <view class="modalContent">
        <view class="modalHeader">
          <text>{{ t('studio.chooseHistoricalModel') }}</text>
          <button size="mini" @click="showModelHistory = false">✕</button>
        </view>
        <scroll-view scroll-y class="modalBody">
          <view v-if="historicalModelImages.length === 0" class="emptyModal">{{ t('studio.noHistoricalModel') }}</view>
          <view v-else class="imgGrid">
            <image v-for="img in historicalModelImages" :key="img.id" :src="getThumbnailUrl(img.image_url)" class="gridImg" mode="aspectFill" @click="selectHistoricalModel(img)" />
          </view>
        </scroll-view>
      </view>
    </view>
    <view v-if="showExampleModel" class="modal" @click.self="showExampleModel = false">
      <view class="modalContent">
        <view class="modalHeader">
          <text>{{ t('studio.chooseExampleModel') }}</text>
          <button size="mini" @click="showExampleModel = false">✕</button>
        </view>
        <scroll-view scroll-y class="modalBody">
          <view class="imgGrid">
            <image v-for="(url, i) in exampleModelImages" :key="i" :src="getMediumImageUrl(url)" class="gridImg" mode="aspectFill" @click="selectExampleModel(url)" />
          </view>
        </scroll-view>
      </view>
    </view>
    <view v-if="showBgHistory" class="modal" @click.self="showBgHistory = false">
      <view class="modalContent">
        <view class="modalHeader">
          <text>{{ t('studio.chooseHistoricalBackground') }}</text>
          <button size="mini" @click="showBgHistory = false">✕</button>
        </view>
        <scroll-view scroll-y class="modalBody">
          <view v-if="historicalBgImages.length === 0" class="emptyModal">{{ t('studio.noHistoricalBackground') }}</view>
          <view v-else class="imgGrid">
            <image v-for="img in historicalBgImages" :key="img.id" :src="getThumbnailUrl(img.image_url)" class="gridImg" mode="aspectFill" @click="selectHistoricalBg(img)" />
          </view>
        </scroll-view>
      </view>
    </view>
    <view v-if="showExampleBg" class="modal" @click.self="showExampleBg = false">
      <view class="modalContent modalExampleBg">
        <view class="modalHeader">
          <text>{{ t('studio.chooseExampleBackground') }}</text>
          <view class="modalCloseBtn" @click="showExampleBg = false">✕</view>
        </view>
        <scroll-view scroll-y class="modalBody modalExampleBgBody">
          <view v-if="exampleBgImages.length === 0" class="emptyModal">{{ t('studio.noExampleBackground') }}</view>
          <view v-else class="exampleBgGrid">
            <view
              v-for="(ex, i) in exampleBgImages"
              :key="i"
              class="exampleBgItem"
              @click="selectExampleBg(ex)"
            >
              <image :src="getSmallImageUrl(ex.url)" class="exampleBgImg" mode="aspectFill" />
              <view class="exampleBgOverlay">
                <text class="exampleBgHint">{{ t('studio.clickToUse') }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
        
      </view>
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, inject } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { useStudioStore } from '@/store/studio'
import { apiClient, uploadApiClient } from '@/lib/api-client'
import { getThumbnailUrl, getSmallImageUrl, getMediumImageUrl, getLargeImageUrl } from '@/lib/imageOptimizer'
import type { Item, AgentOutfit } from '@fashion-rec/shared'

const props = defineProps<{ embedded?: boolean }>()
const { t } = useI18n()
// 延迟获取 store，避免 App 端 Pinia 未初始化导致白屏（unibest 文档建议）
const store = computed(() => useStudioStore())

const exampleModelImages = ['https://r2.fashion-rec.com/example/IMG_9953.JPG', 'https://r2.fashion-rec.com/example/IMG_9954.JPG']
const exampleBgImages = [
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
]

interface HistoricalImage { id: string; image_url: string; created_at: string }

const historicalModelImages = ref<HistoricalImage[]>([])
const historicalBgImages = ref<HistoricalImage[]>([])
const showModelHistory = ref(false)
const showExampleModel = ref(false)
const showBgHistory = ref(false)
const showExampleBg = ref(false)
const isGenerating = ref(false)
const isTryingOn = ref(false)
const isUploadingModel = ref(false)
const isUploadingBg = ref(false)
const modelUploadProgress = ref(0)
const applyingIdx = ref<number | null>(null)
const appliedIdx = ref<number | null>(null)
const isSavingFavorite = ref(false)
const modelTempPath = ref('') // temp path when user picks new image (before upload completes)

// Model picker options (for non-H5 platforms)
const modelOptions = [
  { label: 'Qwen', value: 'qwen' as const },
  { label: 'Grok', value: 'grok' as const },
]
const modelPickerIndex = computed(() => modelOptions.findIndex((o) => o.value === store.value.selectedModel))
const modelDisplayLabel = computed(() => modelOptions[modelPickerIndex.value]?.label ?? 'Qwen')
function onModelPickerChange(e: { detail: { value: number } }) {
  store.value.selectedModel = modelOptions[e.detail.value].value
  saveStore()
}

const EXAMPLE_MODELS = [
  { id: 'example-IMG_9953', url: 'https://r2.fashion-rec.com/example/IMG_9953.JPG' },
  { id: 'example-IMG_9954', url: 'https://r2.fashion-rec.com/example/IMG_9954.JPG' },
]

const activeModelUrl = computed<string | null>(() => {
  const id = store.value.activeModelId
  if (!id) return null
  const ex = EXAMPLE_MODELS.find(e => e.id === id)
  if (ex) return ex.url
  const model = historicalModelImages.value.find(m => m.id === id)
  return model?.image_url ?? null
})

function findModelIdByUrl(url: string): string | null {
  const ex = EXAMPLE_MODELS.find(e => e.url === url)
  if (ex) return ex.id
  const model = historicalModelImages.value.find(m => m.image_url === url)
  return model?.id ?? null
}

const step1Done = computed(() => !!store.value.activeModelId)
const step2Done = computed(() => store.value.hasTryOnInput)
const step3Done = computed(() => !!store.value.tryOnImageUrl)

const BASE_URL = (uploadApiClient.defaults.baseURL || '').replace(/\/$/, '')
const token = () => uni.getStorageSync('auth_token')

function formatFeature(v: string | string[] | undefined) {
  if (!v) return 'Unknown'
  return Array.isArray(v) ? v.join(', ') : v
}
function translateRole(role: string) {
  const m: Record<string, string> = {
    top: t('studio.outfitPlans.roles.top'),
    bottom: t('studio.outfitPlans.roles.bottom'),
    outer: t('studio.outfitPlans.roles.outer'),
    shoes: t('studio.outfitPlans.roles.shoes'),
    accessory: t('studio.outfitPlans.roles.accessory'),
  }
  return m[role.toLowerCase()] || role
}

function saveStore() { store.value.persist() }
watch(() => store.value.customPrompt, saveStore)
watch(() => store.value.backgroundImageUrl, saveStore)
watch(() => store.value.backgroundImagePreviewUrl, saveStore)
watch(() => store.value.backgroundActionPrompt, saveStore)
watch(() => store.value.activeModelId, saveStore)
watch(() => store.value.tryOnImageUrl, saveStore)
watch(() => store.value.selectedModel, saveStore)
watch(() => store.value.agentOutfits, saveStore, { deep: true })
watch(() => store.value.activeWardrobeIds, saveStore, { deep: true })
watch(() => store.value.uploadedItems, saveStore, { deep: true })
watch(() => store.value.activeWardrobeRoleMapEntries, saveStore, { deep: true })
watch(() => store.value.originalAppliedOutfit, saveStore, { deep: true })

function initStudio() {
  if (!token()) return
  store.value.hydrate()
  syncFromWardrobe()
  loadHistoricalImages()
  restoreFromTryonHistory()
}
onShow(() => {
  if (props.embedded) return
  if (!token()) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/studio/studio') })
    return
  }
  initStudio()
})
onMounted(() => {
  if (props.embedded) initStudio()
})

function restoreFromTryonHistory() {
  const raw = uni.getStorageSync('tryon_history_restore')
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    if (data.prompt) store.value.customPrompt = data.prompt
    if (data.background_image_url) {
      store.value.backgroundImageUrl = data.background_image_url
      store.value.backgroundImagePreviewUrl = data.background_image_url
    }
    if (data.image_url) store.value.tryOnImageUrl = data.image_url
    if (data.model_image_id) {
      store.value.activeModelId = data.model_image_id
    } else if (data.model_image_url) {
      const id = findModelIdByUrl(data.model_image_url)
      if (id) store.value.activeModelId = id
    }
    if (data.garment_urls && Array.isArray(data.garment_urls) && data.garment_urls.length > 0 && store.value.uploadedItems.length > 0) {
      const matched: string[] = []
      data.garment_urls.forEach((url: string) => {
        const item = store.value.uploadedItems.find((u) => (u.url || u.features?.path) === url || ((u.url || u.features?.path) && url?.includes(u.url || u.features?.path || '')))
        if (item?.id) matched.push(String(item.id))
      })
      if (matched.length) store.value.activeWardrobeIds = matched
    }
    uni.removeStorageSync('tryon_history_restore')
    saveStore()
  } catch (_) {}
}

onLoad(() => {
  store.value.hydrate()
})

function syncFromWardrobe() {
  const cached = uni.getStorageSync('wardrobe-items')
  if (cached) {
    try {
      const items = JSON.parse(cached) as Item[]
      if (Array.isArray(items)) store.value.uploadedItems = items
    } catch (_) {}
  }
  const selected = uni.getStorageSync('wardrobe-selected-ids')
  if (selected) {
    try {
      const ids = JSON.parse(selected) as string[]
      if (Array.isArray(ids) && ids.length > 0) {
        store.value.activeWardrobeIds = [...new Set([...store.value.activeWardrobeIds, ...ids])]
        store.value.selectedItemIds = ids
      }
    } catch (_) {}
  }
}

async function loadHistoricalImages() {
  try {
    const [bgRes, modelRes] = await Promise.all([
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=background'),
      apiClient.get<{ images: HistoricalImage[] }>('/user-images?image_type=model'),
    ])
    historicalBgImages.value = bgRes.data?.images || []
    historicalModelImages.value = modelRes.data?.images || []
  } catch (err: any) {
    console.warn('[Studio] Failed to load historical images:', err?.response?.status, err?.message)
    // 401 表示token过期或无效，静默失败（用户刷新页面时会重新登录）
    // 其他错误（如网络问题）也静默处理，不影响主流程
  }
}

function chooseModelImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths?.[0]
      if (!path) return
      isUploadingModel.value = true
      modelUploadProgress.value = 0
      uni.uploadFile({
        url: BASE_URL + '/model-image',
        filePath: path,
        name: 'file',
        header: { Authorization: 'Bearer ' + token() },
        success: (u) => {
          if (u.statusCode === 200) {
            try {
              const d = JSON.parse(u.data)
              if (d.url) {
                modelTempPath.value = ''
                loadHistoricalImages().then(() => {
                  const id = findModelIdByUrl(d.url)
                  if (id) store.value.activeModelId = id
                  saveStore()
                })
              }
            } catch (_) {}
          }
          isUploadingModel.value = false
          modelUploadProgress.value = 100
        },
        fail: () => {
          isUploadingModel.value = false
          uni.showToast({ title: t('studio.errors.uploadFailed'), icon: 'none' })
        },
      })
    },
  })
}

function removeModelImage() {
  store.value.activeModelId = null
  modelTempPath.value = ''
  saveStore()
}

function selectHistoricalModel(img: HistoricalImage) {
  store.value.activeModelId = img.id
  showModelHistory.value = false
  saveStore()
}

function selectExampleModel(url: string) {
  const id = findModelIdByUrl(url)
  if (id) {
    store.value.activeModelId = id
  } else {
    uni.showToast({ title: 'Model not found', icon: 'none' })
  }
  showExampleModel.value = false
  saveStore()
}

function chooseBackgroundImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths?.[0]
      if (!path) return
      isUploadingBg.value = true
      uni.uploadFile({
        url: BASE_URL + '/background-image',
        filePath: path,
        name: 'file',
        header: { Authorization: 'Bearer ' + token() },
        success: (u) => {
          if (u.statusCode === 200) {
            try {
              const d = JSON.parse(u.data)
              if (d.url) {
                store.value.backgroundImageUrl = d.url
                store.value.backgroundImagePreviewUrl = d.url
                loadHistoricalImages()
              }
            } catch (_) {}
          }
          isUploadingBg.value = false
        },
        fail: () => {
          isUploadingBg.value = false
          uni.showToast({ title: t('studio.errors.uploadFailed'), icon: 'none' })
        },
      })
    },
  })
}

function removeBackgroundImage() {
  store.value.backgroundImageUrl = null
  store.value.backgroundImagePreviewUrl = null
  saveStore()
}

function selectHistoricalBg(img: HistoricalImage) {
  store.value.backgroundImageUrl = img.image_url
  store.value.backgroundImagePreviewUrl = img.image_url
  showBgHistory.value = false
  saveStore()
}

function selectExampleBg(ex: { url: string; prompt: string }) {
  if (ex.url.includes('r2.fashion-rec.com')) {
    store.value.backgroundImageUrl = ex.url
    store.value.backgroundImagePreviewUrl = ex.url
    if (ex.prompt.startsWith('studio.')) store.value.backgroundActionPrompt = t(ex.prompt)
    else store.value.backgroundActionPrompt = ex.prompt
    store.value.backgroundTabValue = 'with-background'
  }
  showExampleBg.value = false
  saveStore()
}

function chooseNoBackgroundAndClose() {
  removeBackgroundImage()
  store.value.backgroundTabValue = 'no-background'
  showExampleBg.value = false
  saveStore()
}

function chooseWithBackgroundAndClose() {
  store.value.backgroundTabValue = 'with-background'
  showExampleBg.value = false
  saveStore()
}

async function getRecommendations() {
  isGenerating.value = true
  store.value.agentOutfits = []
  store.value.tryOnImageUrl = null
  try {
    if (store.value.uploadedItems.length === 0) {
      const res = await apiClient.get<{ items: unknown[] }>('/items')
      const raw = res.data?.items || []
      store.value.uploadedItems = raw.map((item: unknown) => {
        const o = item as Record<string, unknown>
        return { id: o.id, url: (o.path || o.url) as string, features: { path: (o.path || o.url) as string, type: (o.type as string) || 'Unknown', color: (o.color as string) || 'Unknown', style: (o.style as string) || 'Unknown', pattern: o.pattern, occasion: o.occasion, material: o.material, gender: o.gender, description: o.description } } as Item
      })
    }
    const payload = {
      base_item_ids: store.value.activeWardrobeIds.length ? store.value.activeWardrobeIds : undefined,
      prompt: store.value.customPrompt,
      background_image_url: store.value.backgroundImageUrl || undefined,
      background_action_prompt: store.value.backgroundTabValue === 'with-background' && store.value.backgroundActionPrompt ? store.value.backgroundActionPrompt : undefined,
      model_image_url: activeModelUrl.value || undefined,
      selected_items_roles: store.value.activeWardrobeIds.length ? Object.fromEntries(store.value.getActiveWardrobeRoleMap()) : undefined,
      model: store.value.selectedModel,
    }
    const res = await uploadApiClient.post<{ outfits: AgentOutfit[] }>('/outfit', payload)
    store.value.agentOutfits = res.data?.outfits || []
    saveStore()
  } catch (e: unknown) {
    uni.showToast({ title: (e as { message?: string })?.message || 'Failed', icon: 'none' })
  } finally {
    isGenerating.value = false
  }
}

async function applyOutfit(outfit: AgentOutfit, idx: number) {
  applyingIdx.value = idx
  appliedIdx.value = null
  try {
    if (store.value.uploadedItems.length === 0) {
      const res = await apiClient.get<{ items: unknown[] }>('/items')
      const raw = res.data?.items || []
      store.value.uploadedItems = raw.map((item: unknown) => {
        const o = item as Record<string, unknown>
        return { id: o.id, url: (o.path || o.url) as string, features: { path: (o.path || o.url) as string, type: (o.type as string) || 'Unknown', color: (o.color as string) || 'Unknown', style: (o.style as string) || 'Unknown', pattern: o.pattern, occasion: o.occasion, material: o.material, gender: o.gender, description: o.description } } as Item
      })
    }
    const ids = outfit.items.map((it) => it.wardrobe_id).filter(Boolean).map(String)
    store.value.activeWardrobeIds = ids
    const map = new Map<string, string>()
    outfit.items.forEach((it) => { if (it.wardrobe_id) map.set(String(it.wardrobe_id), it.role) })
    store.value.setActiveWardrobeRoleMap(map)
    store.value.originalAppliedOutfit = outfit
    appliedIdx.value = idx
    saveStore()
  } catch (e: unknown) {
    uni.showToast({ title: (e as { message?: string })?.message || 'Failed', icon: 'none' })
  } finally {
    applyingIdx.value = null
  }
}

function removeActiveItem(id: string) {
  store.value.activeWardrobeIds = store.value.activeWardrobeIds.filter((i) => i !== id)
  const map = store.value.getActiveWardrobeRoleMap()
  map.delete(id)
  store.value.setActiveWardrobeRoleMap(map)
  saveStore()
}

const switchToWardrobe = inject<(() => void) | null>('switchToWardrobe', null)
function goToWardrobe() {
  if (switchToWardrobe) {
    switchToWardrobe()
  } else {
    uni.navigateTo({ url: '/pages/wardrobe/wardrobe' })
  }
}

async function performTryOn() {
  if (!activeModelUrl.value && !modelTempPath.value) {
    uni.showToast({ title: t('studio.modelPhoto.pleaseUploadFirst'), icon: 'none' })
    return
  }
  const garmentUrls = store.value.activeWardrobeItems.map((i) => i.url || i.features.path).filter(Boolean) as string[]
  const unmatched = store.value.unmatchedOutfitDescriptions
  if (garmentUrls.length === 0 && unmatched.length === 0) {
    uni.showToast({ title: t('studio.outfitPlans.pleaseChooseOutfit'), icon: 'none' })
    return
  }
  isTryingOn.value = true
  store.value.tryOnImageUrl = null
  store.value.setFavoriteStatus(false, null)
  try {
    const fd = new FormData()
    if (activeModelUrl.value) {
      fd.append('person_image_url', activeModelUrl.value)
    }
    fd.append('garment_urls', JSON.stringify(garmentUrls))
    if (unmatched.length) fd.append('unmatched_descriptions', JSON.stringify(unmatched))
    if (store.value.backgroundImageUrl) fd.append('background_image_url', store.value.backgroundImageUrl)
    if (store.value.backgroundActionPrompt) fd.append('background_action_prompt', store.value.backgroundActionPrompt)
    if (store.value.customPrompt) fd.append('prompt', store.value.customPrompt)

    const res = await uploadApiClient.post<{ url: string }>('/try-on', fd)
    store.value.tryOnImageUrl = res.data?.url || null
    saveStore()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string }; status?: number }; message?: string }
    const msg = err.response?.data?.detail || err.message || t('studio.errors.tryOnFailed')
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    isTryingOn.value = false
  }
}

async function saveFavorite() {
  if (!store.value.tryOnImageUrl) return
  if (store.value.favoriteSaved && store.value.currentFavoriteId) {
    try {
      await apiClient.delete(`/favorites/${store.value.currentFavoriteId}`)
      if (store.value.setFavoriteStatus) store.value.setFavoriteStatus(false, null)
      saveStore()
    } catch (_) {
      uni.showToast({ title: t('studio.errors.saveFavoriteFailed'), icon: 'none' })
    }
    return
  }
  isSavingFavorite.value = true
  try {
    const garmentUrls = store.value.activeWardrobeItems.map((i) => i.url || i.features.path).filter(Boolean) as string[]
    const res = await apiClient.post<{ id: string }>('/favorites', {
      image_url: store.value.tryOnImageUrl,
      title: store.value.originalAppliedOutfit?.title || 'Try-on result',
      garment_urls: garmentUrls.length ? garmentUrls : undefined,
      background_image_url: store.value.backgroundImageUrl || undefined,
      prompt: store.value.customPrompt || undefined,
      model_image_url: activeModelUrl.value || undefined,
      model_image_id: store.value.activeModelId || undefined,
    })
    if (store.value.setFavoriteStatus) store.value.setFavoriteStatus(true, res.data.id)
    saveStore()
  } catch (_) {
    uni.showToast({ title: t('studio.errors.saveFavoriteFailed'), icon: 'none' })
  } finally {
    isSavingFavorite.value = false
  }
}

function previewImage(url: string) {
  uni.previewImage({ urls: [url] })
}
</script>

<style scoped>
.page { height: 100vh; background: linear-gradient(180deg, #fdf2f8 0%, #fff 50%, #faf5ff 100%); }
.container { padding: 24rpx; padding-bottom: 120rpx; }
.stepper { display: flex; gap: 24rpx; margin-bottom: 24rpx; font-size: 24rpx; }
.step { color: #999; }
.step.active { color: #ec4899; font-weight: bold; }
.card { background: #fff; border-radius: 24rpx; padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid #fce7f3; }
.cardTitle { font-size: 36rpx; font-weight: bold; background: linear-gradient(90deg, #ec4899, #a855f7); -webkit-background-clip: text; color: transparent; display: block; margin-bottom: 16rpx; }
.cardDesc { font-size: 26rpx; color: #666; display: block; margin-bottom: 16rpx; }
.tabs { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.tab { padding: 16rpx 24rpx; border-radius: 12rpx; background: #f3f4f6; font-size: 26rpx; }
.tab.active { background: #fce7f3; color: #ec4899; }
.textarea { width: 100%; padding: 20rpx; border: 1rpx solid #fce7f3; border-radius: 16rpx; font-size: 28rpx; box-sizing: border-box; }
.btnPrimary { width: 100%; background: linear-gradient(90deg, #ec4899, #a855f7); color: #fff; padding: 24rpx; border-radius: 16rpx; font-size: 30rpx; margin-top: 16rpx; }
.branding { font-size: 22rpx; color: #ec4899; display: block; margin-top: 16rpx; text-align: center; }
.model-select {
  appearance: none;
  -webkit-appearance: none;
  padding: 12rpx 48rpx 12rpx 20rpx;
  border: 2rpx solid #fce7f3;
  border-radius: 16rpx;
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ec4899' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12rpx center;
  background-size: 20rpx;
  font-size: 26rpx;
  color: #ec4899;
  font-weight: 500;
  min-width: 160rpx;
  cursor: pointer;
  outline: none;
  height: auto;
  line-height: 1.5;
}
.model-select:focus { border-color: #ec4899; }
.model-select-app {
  padding: 12rpx 20rpx;
  border: 2rpx solid #fce7f3;
  border-radius: 16rpx;
  background: #fff;
  font-size: 26rpx;
  color: #ec4899;
  font-weight: 500;
  min-width: 120rpx;
  text-align: center;
}
.modelPreview, .modelEmpty { padding: 16rpx; }
.modelImg { width: 256rpx; height: 256rpx; border-radius: 16rpx; display: block; margin-bottom: 16rpx; }
.uploadOverlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
.uploadPercent { color: #fff; font-size: 32rpx; }
.modelActions, .row { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 16rpx; }
.bgSection { margin-top: 16rpx; }
.bgPreview { position: relative; display: block; width: 100%; margin-top: 16rpx; }
.bgThumb { width: 100%; height: 240rpx; border-radius: 16rpx; display: block; }
.emptyIcon { font-size: 64rpx; display: block; text-align: center; margin-bottom: 16rpx; }
.emptyDesc { font-size: 24rpx; color: #ec4899; display: block; margin-top: 16rpx; }
.appliedCount { font-size: 26rpx; margin-bottom: 16rpx; }
.emptyApplied { text-align: center; padding: 48rpx; }
.emptyApplied text { display: block; margin-bottom: 8rpx; }
.hint { font-size: 24rpx; color: #ec4899; }
.appliedGrid { display: flex; flex-wrap: wrap; gap: 24rpx; }
.appliedItem { position: relative; width: 160rpx; text-align: center; }
.itemThumb { width: 160rpx; height: 160rpx; border-radius: 16rpx; background: #fce7f3; }
.delBtn, .btnDel { position: absolute; top: -8rpx; right: -8rpx; width: 48rpx; height: 48rpx; padding: 0; line-height: 48rpx; background: #ef4444; color: #fff; border-radius: 50%; font-size: 24rpx; }
.itemLabel { font-size: 22rpx; display: block; margin-top: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.outfitPlans { margin-top: 24rpx; }
.planTitle { font-size: 30rpx; font-weight: 600; display: block; margin-bottom: 16rpx; }
.outfitScroll { white-space: nowrap; padding-bottom: 16rpx; }
.outfitCard { display: inline-block; width: 560rpx; margin-right: 24rpx; padding: 24rpx; background: #f9fafb; border-radius: 16rpx; border: 1rpx solid #e5e7eb; vertical-align: top; }
.outfitTitle { font-weight: 600; display: block; margin-bottom: 8rpx; }
.outfitReason { font-size: 24rpx; color: #ec4899; display: block; margin-bottom: 16rpx; }
.outfitItem { font-size: 24rpx; margin-bottom: 8rpx; }
.outfitItem .role { color: #666; }
.outfitCard button.applied { background: #10b981; color: #fff; }
.loadingBlock { padding: 48rpx; text-align: center; }
.loadingText { color: #ec4899; font-size: 28rpx; }
.tryOnCtrl { padding: 24rpx; background: #f9fafb; border-radius: 16rpx; }
.btnTryOn { padding: 20rpx 32rpx; border: 2rpx solid #ec4899; color: #ec4899; border-radius: 16rpx; font-size: 28rpx; }
.tryOnResult { margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #fce7f3; }
.resultHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.resultTitle { font-size: 30rpx; font-weight: 600; }
.resultImg { width: 100%; border-radius: 16rpx; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 48rpx; }
.modalContent { background: #fff; border-radius: 24rpx; max-height: 80vh; width: 100%; overflow: hidden; }
.modalHeader { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; border-bottom: 1rpx solid #eee; }
.modalBody { max-height: 60vh; }
.imgGrid { display: flex; flex-wrap: wrap; gap: 24rpx; }
.gridImg { width: 200rpx; height: 280rpx; border-radius: 12rpx; }
.emptyModal { text-align: center; padding: 48rpx; color: #ec4899; }

/* Example background modal - 完全复刻前端 */
.modalExampleBg { display: flex; flex-direction: column; max-height: 85vh; box-shadow: 0 25rpx 50rpx rgba(0,0,0,0.15); }
.modalCloseBtn { padding: 8rpx 16rpx; background: transparent; color: #ec4899; font-size: 28rpx; display: flex; align-items: center; justify-content: center; min-width: 64rpx; min-height: 64rpx; }
.modalExampleBgBody { flex: 1; overflow-y: auto; max-height: 55vh; }
.exampleBgGrid { display: flex; flex-direction: column; gap: 24rpx; width: 100%; box-sizing: border-box; }
.exampleBgItem { position: relative; width: calc(100% - 48rpx); height: 360rpx; margin: 0 24rpx; border-radius: 16rpx; overflow: hidden; border: none; box-sizing: border-box; }
.exampleBgImg { width: 100%; height: 100%; display: block; }
.exampleBgOverlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.2); display: flex; align-items: flex-end; justify-content: center; padding: 16rpx; }
.exampleBgHint { font-size: 24rpx; background: rgba(255,255,255,0.9); color: #374151; padding: 8rpx 24rpx; border-radius: 8rpx; font-weight: 500; border: none; }
.modalFooter { display: flex; gap: 24rpx; padding: 24rpx; border-top: 1rpx solid #fce7f3; }
.exampleBgBtn { flex: 1; text-align: center; padding: 24rpx; border-radius: 16rpx; font-size: 28rpx; font-weight: 500; border: none; }
.exampleBgBtnNo { background: #f3f4f6; color: #6b7280; }
.exampleBgBtnYes { background: linear-gradient(90deg, #ec4899, #a855f7); color: #fff; }
</style>
