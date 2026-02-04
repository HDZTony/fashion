<template>
  <view class="page">
    <view class="header">
      <text class="title">{{ t('multiAngle.title') }}</text>
    </view>
    <scroll-view scroll-y class="content">
      <view class="section">
        <text class="section-title">{{ t('multiAngle.sourceImage') }}</text>
        <view v-if="sourceImageUrl" class="source-area">
          <view class="source-preview-wrap" @click="chooseImage">
            <image :src="getMediumImageUrl(sourceImageUrl)" class="source-preview" mode="aspectFill" />
            <view class="source-overlay">
              <text class="overlay-text">{{ t('multiAngle.changeImage') }}</text>
            </view>
          </view>
          <view v-if="isUploading" class="uploading">
            <text class="loading-text">{{ t('common.loading') }}</text>
          </view>
          <view class="controls">
            <text class="presets-label">{{ t('multiAngle.presets') }}</text>
            <view class="preset-btns">
              <button
                v-for="preset in anglePresets"
                :key="preset.name"
                class="preset-btn"
                :disabled="isGeneratingAngle"
                @click="generateMultiAngle(preset.name)"
              >
                <text class="preset-icon">{{ preset.icon }}</text>
                <text class="preset-label">{{ t(preset.label) }}</text>
              </button>
            </view>
            <view class="custom-toggle" @click="showCustomAnglePanel = !showCustomAnglePanel">
              <text class="custom-label">{{ t('multiAngle.custom') }}</text>
              <text class="chevron">{{ showCustomAnglePanel ? '▼' : '▶' }}</text>
            </view>
            <view v-if="showCustomAnglePanel" class="custom-panel">
              <view class="slider-row">
                <text class="slider-label">{{ t('multiAngle.horizontal') }}</text>
                <text class="slider-value">{{ angleParams.horizontal }}°</text>
              </view>
              <wd-slider v-model="angleParams.horizontal" :min="0" :max="360" :step="15" />
              <view class="slider-row">
                <text class="slider-label">{{ t('multiAngle.vertical') }}</text>
                <text class="slider-value">{{ angleParams.vertical }}°</text>
              </view>
              <wd-slider v-model="angleParams.vertical" :min="-30" :max="90" :step="10" />
              <view class="slider-row">
                <text class="slider-label">{{ t('multiAngle.zoom') }}</text>
                <text class="slider-value">{{ angleParams.zoom }}</text>
              </view>
              <wd-slider v-model="angleParams.zoom" :min="0" :max="10" :step="1" />
              <button
                class="generate-btn"
                :disabled="isGeneratingAngle"
                @click="generateMultiAngle()"
              >
                {{ isGeneratingAngle ? t('multiAngle.generating') : t('multiAngle.generate') }}
              </button>
            </view>
          </view>
        </view>
        <view v-else class="upload-area" @click="chooseImage">
          <view v-if="isUploading" class="uploading-inner">
            <text class="loading-text">{{ t('common.loading') }}</text>
          </view>
          <view v-else class="upload-inner">
            <text class="upload-icon">📤</text>
            <text class="upload-text">{{ t('multiAngle.dropImageHere') }}</text>
            <text class="upload-hint">{{ t('multiAngle.supportedFormats') }}</text>
          </view>
        </view>
      </view>

      <view v-if="isGeneratingAngle && multiAngleImages.length === 0" class="loading-block">
        <text class="loading-text">{{ t('multiAngle.generating') }}</text>
      </view>

      <view v-if="multiAngleImages.length > 0" class="section results-section">
        <view class="results-header">
          <text class="section-title">{{ t('multiAngle.results') }}</text>
          <button
            v-if="multiAngleImages.some(img => !img.id)"
            class="clear-btn"
            @click="clearCurrentImages"
          >
            {{ t('multiAngle.clearAll') }}
          </button>
        </view>
        <view class="results-grid">
          <view
            v-for="(img, index) in multiAngleImages"
            :key="img.id || index"
            class="result-item"
            @click="previewImage(index)"
          >
            <image :src="getMediumImageUrl(img.url)" class="result-img" mode="aspectFill" />
            <view class="result-overlay">
              <text class="angle-type">{{ img.angle_type }}</text>
            </view>
            <button
              v-if="img.id"
              class="del-btn"
              @click.stop="deleteHistoryItem(img.id)"
            >
              ×
            </button>
          </view>
        </view>
      </view>

      <view v-else-if="!isLoadingHistory && !sourceImageUrl" class="empty-section">
        <text class="empty-icon">🔄</text>
        <text class="empty-text">{{ t('multiAngle.noHistory') }}</text>
        <text class="empty-desc">{{ t('multiAngle.noHistoryDesc') }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiClient } from '@/lib/api-client'
import { longUploadApiClient } from '@/lib/api-client'
import { getMediumImageUrl } from '@/lib/imageOptimizer'
import { API_URL } from '@/config/api'

defineProps<{ embedded?: boolean }>()
const { t } = useI18n()

const anglePresets = [
  { name: 'front', label: 'multiAngle.front', icon: '正' },
  { name: 'left', label: 'multiAngle.left', icon: '左' },
  { name: 'right', label: 'multiAngle.right', icon: '右' },
  { name: 'back', label: 'multiAngle.back', icon: '后' },
  { name: 'top', label: 'multiAngle.top', icon: '俯' },
]

const sourceImageUrl = ref('')
const isUploading = ref(false)
const isGeneratingAngle = ref(false)
const showCustomAnglePanel = ref(false)
const isLoadingHistory = ref(false)
interface MultiAngleImage {
  id?: string
  url: string
  angle_type: string
  angle_params?: unknown
  created_at?: string
}
const multiAngleImages = ref<MultiAngleImage[]>([])
interface HistoryItem {
  id: string
  result_url: string
  angle_type: string
  angle_params?: unknown
  created_at?: string
}
const historyItems = ref<HistoryItem[]>([])

const angleParams = ref({
  horizontal: 0,
  vertical: 0,
  zoom: 5,
})

function getToken(): string {
  return uni.getStorageSync('auth_token') ?? ''
}

async function uploadSource(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: API_URL + '/multiangle-source',
      filePath,
      name: 'file',
      header: { Authorization: 'Bearer ' + getToken() },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data)
            resolve(data.url)
          } catch {
            reject(new Error('Invalid response'))
          }
        } else {
          reject(new Error(res.data || 'Upload failed'))
        }
      },
      fail: reject,
    })
  })
}

async function chooseImage() {
  isUploading.value = true
  try {
    const res = await new Promise<UniApp.ChooseImageSuccessCallbackResult>((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject,
      })
    })
    const path = res.tempFilePaths?.[0]
    if (!path) return
    const url = await uploadSource(path)
    sourceImageUrl.value = url
    multiAngleImages.value = []
    await loadHistory()
  } catch (e) {
    uni.showToast({ title: (e as Error).message || t('common.error'), icon: 'none' })
  } finally {
    isUploading.value = false
  }
}

async function loadHistory() {
  isLoadingHistory.value = true
  try {
    const params: Record<string, string | number> = { page: 1, limit: 20 }
    if (sourceImageUrl.value) params.source_url = sourceImageUrl.value
    const res = await apiClient.get<{ history: HistoryItem[]; total_pages: number }>('/multiangle-history', { params })
    historyItems.value = res.data?.history ?? []
    if (sourceImageUrl.value && historyItems.value.length > 0) {
      multiAngleImages.value = historyItems.value.map((item) => ({
        id: item.id,
        url: item.result_url,
        angle_type: item.angle_type,
        angle_params: item.angle_params,
        created_at: item.created_at,
      }))
    }
  } catch {
    historyItems.value = []
  } finally {
    isLoadingHistory.value = false
  }
}

async function generateMultiAngle(preset?: string) {
  if (!sourceImageUrl.value) {
    uni.showToast({ title: t('multiAngle.noSourceImage'), icon: 'none' })
    return
  }
  isGeneratingAngle.value = true
  try {
    const params: Record<string, string> = {
      image_url: sourceImageUrl.value,
      zoom: String(angleParams.value.zoom),
    }
    if (preset) {
      params.preset = preset
    } else {
      params.horizontal_angle = String(angleParams.value.horizontal)
      params.vertical_angle = String(angleParams.value.vertical)
    }
    const urlParams = new URLSearchParams(params).toString()
    const res = await longUploadApiClient.post<{ url: string; angle_type: string; angle_params: unknown }>(
      '/generate-angles',
      urlParams,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    const data = res.data ?? (res as { data?: { url: string; angle_type: string } }).data
    if (!data?.url) throw new Error('No url in response')
    multiAngleImages.value.unshift({
      url: data.url,
      angle_type: data.angle_type ?? (preset ?? 'custom'),
      angle_params: data.angle_params,
    })
  } catch (e) {
    const err = e as { response?: { status?: number; data?: { detail?: string } }; message?: string }
    let msg = t('multiAngle.generationFailed')
    if (err.response?.status === 401) msg = '认证失败，请刷新页面或重新登录'
    else if (err.response?.status === 403) msg = err.response.data?.detail ?? t('multiAngle.insufficientCredits')
    else if (err.response?.data?.detail) msg = err.response.data.detail
    else if (err.message) msg = err.message
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    isGeneratingAngle.value = false
  }
}

async function deleteHistoryItem(id: string) {
  const { confirm } = await new Promise<{ confirm: boolean }>((resolve) => {
    uni.showModal({
      title: '',
      content: t('multiAngle.deleteConfirm'),
      success: (res) => resolve({ confirm: res.confirm }),
    })
  })
  if (!confirm) return
  try {
    await apiClient.delete(`/multiangle-history/${id}`)
    multiAngleImages.value = multiAngleImages.value.filter((img) => img.id !== id)
    historyItems.value = historyItems.value.filter((item) => item.id !== id)
  } catch (e) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    uni.showToast({ title: err.response?.data?.detail ?? err.message ?? 'Delete failed', icon: 'none' })
  }
}

function clearCurrentImages() {
  multiAngleImages.value = multiAngleImages.value.filter((img: MultiAngleImage) => img.id)
}

function previewImage(index: number) {
  const urls = multiAngleImages.value.map((img) => getMediumImageUrl(img.url)).filter(Boolean)
  if (urls.length === 0) return
  uni.previewImage({ urls, current: urls[index] ?? urls[0] })
}

onLoad((options?: Record<string, string | undefined>) => {
  const sourceImage = options?.sourceImage
  if (sourceImage) {
    sourceImageUrl.value = sourceImage
  }
})

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.page { min-height: 100vh; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); padding: 24rpx; }
.header { margin-bottom: 24rpx; }
.title { font-size: 40rpx; font-weight: 700; background: linear-gradient(90deg, #ec4899, #a855f7); -webkit-background-clip: text; background-clip: text; color: transparent; }
.content { height: calc(100vh - 120rpx); }
.section { background: #fff; padding: 32rpx; border-radius: 24rpx; margin-bottom: 24rpx; border: 1rpx solid rgba(236, 72, 153, 0.15); }
.section-title { font-size: 32rpx; font-weight: 600; color: #111827; display: block; margin-bottom: 24rpx; }
.source-area { display: flex; flex-direction: column; gap: 24rpx; }
.source-preview-wrap { position: relative; width: 240rpx; aspect-ratio: 1; border-radius: 24rpx; overflow: hidden; background: #f3f4f6; }
.source-preview { width: 100%; height: 100%; }
.source-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; }
.source-preview-wrap:active .source-overlay { opacity: 1; }
.overlay-text { color: #fff; font-size: 26rpx; }
.uploading, .uploading-inner { padding: 24rpx; text-align: center; }
.loading-text { color: #be185d; font-size: 28rpx; }
.controls { flex: 1; }
.presets-label { font-size: 26rpx; color: #6b7280; display: block; margin-bottom: 16rpx; }
.preset-btns { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 24rpx; }
.preset-btn { padding: 20rpx 32rpx; border: 1rpx solid rgba(236, 72, 153, 0.3); background: #fff; border-radius: 16rpx; font-size: 26rpx; display: flex; align-items: center; gap: 12rpx; }
.preset-icon { font-size: 32rpx; color: #ec4899; }
.preset-label { color: #374151; }
.custom-toggle { display: flex; align-items: center; gap: 8rpx; margin-bottom: 16rpx; color: #ec4899; font-size: 26rpx; }
.custom-label { }
.chevron { font-size: 24rpx; }
.custom-panel { padding: 24rpx; background: #f9fafb; border-radius: 16rpx; margin-top: 16rpx; }
.slider-row { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.slider-label { font-size: 26rpx; color: #6b7280; }
.slider-value { font-size: 26rpx; font-weight: 600; color: #ec4899; }
.generate-btn { width: 100%; padding: 24rpx; background: linear-gradient(90deg, #ec4899, #a855f7); color: #fff; border-radius: 16rpx; font-size: 30rpx; margin-top: 24rpx; }
.upload-area { border: 2rpx dashed rgba(236, 72, 153, 0.3); border-radius: 24rpx; padding: 64rpx; text-align: center; }
.upload-inner { display: flex; flex-direction: column; align-items: center; gap: 16rpx; }
.upload-icon { font-size: 80rpx; }
.upload-text { font-size: 30rpx; font-weight: 500; color: #374151; }
.upload-hint { font-size: 24rpx; color: #9ca3af; }
.loading-block { padding: 48rpx; text-align: center; }
.results-section { }
.results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.clear-btn { font-size: 24rpx; color: #ec4899; background: none; padding: 0; }
.results-grid { display: flex; flex-wrap: wrap; gap: 24rpx; }
.result-item { position: relative; width: calc(50% - 12rpx); aspect-ratio: 1; border-radius: 24rpx; overflow: hidden; background: #f3f4f6; border: 1rpx solid #e5e7eb; }
.result-img { width: 100%; height: 100%; }
.result-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 16rpx; background: linear-gradient(transparent, rgba(0,0,0,0.6)); }
.angle-type { font-size: 26rpx; color: #fff; font-weight: 500; }
.del-btn { position: absolute; top: 16rpx; right: 16rpx; width: 48rpx; height: 48rpx; padding: 0; background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; font-size: 36rpx; line-height: 48rpx; text-align: center; }
.empty-section { padding: 64rpx; text-align: center; }
.empty-icon { font-size: 96rpx; display: block; margin-bottom: 24rpx; }
.empty-text { font-size: 30rpx; color: #374151; display: block; margin-bottom: 8rpx; }
.empty-desc { font-size: 24rpx; color: #ec4899; }
</style>
