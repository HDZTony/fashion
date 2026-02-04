<template>
  <view class="page" :class="{ 'page-embedded': embedded }">
    <wd-navbar
      v-if="!embedded"
      :title="t('multiAngleHistory.title')"
      left-arrow
      :left-text="t('common.back')"
      fixed
      placeholder
      safe-area-inset-top
      bordered
      @click-left="goBack"
    />
    <!-- 嵌入时 scroll-view 需显式高度才能滚动，uni-app 限制 -->
    <scroll-view
      v-if="embedded"
      scroll-y
      class="scroll-area"
      :style="scrollAreaStyle"
    >
      <view class="main">
        <view v-if="isLoading" class="loading-wrap">
          <view class="spinner" />
          <text class="loading-text">{{ t('common.loading') }}</text>
        </view>
        <view v-else-if="error" class="error-wrap">
          <text class="error-text">{{ error }}</text>
        </view>
        <view v-else-if="historyItems.length === 0" class="empty-section">
          <view class="empty-card">
            <text class="empty-icon">📷</text>
            <text class="empty-title">{{ t('multiAngleHistory.empty') }}</text>
            <text class="empty-desc">{{ t('multiAngleHistory.emptyDesc') }}</text>
            <button class="btn-go" @click="goToMultiAngle">
              <text class="btn-icon">🔄</text>
              {{ t('multiAngleHistory.goToMultiAngle') }}
            </button>
          </view>
        </view>
        <view v-else class="history-section">
          <view class="history-card">
            <view class="section-header">
              <text class="section-title">{{ t('multiAngleHistory.totalItems', { count: totalItems }) }}</text>
            </view>
            <view class="grid">
              <view v-for="item in historyItems" :key="item.id" class="item-card">
                <view class="images-row">
                  <view class="half source-half" @click="viewInMultiAngle(item.source_tryon_url)">
                    <image :src="getMediumImageUrl(item.source_tryon_url)" class="half-img" mode="aspectFill" />
                    <view class="half-overlay">
                      <button class="overlay-btn" @click.stop="viewInMultiAngle(item.source_tryon_url)">
                        {{ t('multiAngleHistory.generateMore') }}
                      </button>
                    </view>
                    <text class="badge source-badge">{{ t('multiAngleHistory.source') }}</text>
                  </view>
                  <view class="half result-half" @click="previewImage(item.result_url)">
                    <image :src="getMediumImageUrl(item.result_url)" class="half-img" mode="aspectFill" />
                    <view class="half-overlay">
                      <text class="overlay-text">{{ t('multiAngleHistory.viewFull') }}</text>
                    </view>
                    <text class="badge result-badge">{{ getAngleLabel(item.angle_type) }}</text>
                  </view>
                </view>
                <view class="item-footer">
                  <view class="footer-date">
                    <text class="date-icon">📅</text>
                    <text class="date-text">{{ formatDate(item.created_at) }}</text>
                  </view>
                  <button class="del-btn" @click="deleteItem(item.id)">
                    <text class="del-icon">×</text>
                  </button>
                </view>
              </view>
            </view>
            <view v-if="totalPages > 1" class="pagination">
              <button
                class="page-btn"
                :disabled="currentPage === 1 || isLoading"
                @click="goToPage(currentPage - 1)"
              >
                ‹
              </button>
              <text class="page-info">{{ currentPage }} / {{ totalPages }}</text>
              <button
                class="page-btn"
                :disabled="currentPage === totalPages || isLoading"
                @click="goToPage(currentPage + 1)"
              >
                ›
              </button>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
    <!-- 非嵌入时保持原布局 -->
    <view v-else class="main">
      <view v-if="isLoading" class="loading-wrap">
        <view class="spinner" />
        <text class="loading-text">{{ t('common.loading') }}</text>
      </view>
      <view v-else-if="error" class="error-wrap">
        <text class="error-text">{{ error }}</text>
      </view>
      <view v-else-if="historyItems.length === 0" class="empty-section">
        <view class="empty-card">
          <text class="empty-icon">📷</text>
          <text class="empty-title">{{ t('multiAngleHistory.empty') }}</text>
          <text class="empty-desc">{{ t('multiAngleHistory.emptyDesc') }}</text>
          <button class="btn-go" @click="goToMultiAngle">
            <text class="btn-icon">🔄</text>
            {{ t('multiAngleHistory.goToMultiAngle') }}
          </button>
        </view>
      </view>
      <view v-else class="history-section">
        <view class="history-card">
          <view class="section-header">
            <text class="section-title">{{ t('multiAngleHistory.totalItems', { count: totalItems }) }}</text>
          </view>
          <view class="grid">
            <view v-for="item in historyItems" :key="item.id" class="item-card">
              <view class="images-row">
                <view class="half source-half" @click="viewInMultiAngle(item.source_tryon_url)">
                  <image :src="getMediumImageUrl(item.source_tryon_url)" class="half-img" mode="aspectFill" />
                  <view class="half-overlay">
                    <button class="overlay-btn" @click.stop="viewInMultiAngle(item.source_tryon_url)">
                      {{ t('multiAngleHistory.generateMore') }}
                    </button>
                  </view>
                  <text class="badge source-badge">{{ t('multiAngleHistory.source') }}</text>
                </view>
                <view class="half result-half" @click="previewImage(item.result_url)">
                  <image :src="getMediumImageUrl(item.result_url)" class="half-img" mode="aspectFill" />
                  <view class="half-overlay">
                    <text class="overlay-text">{{ t('multiAngleHistory.viewFull') }}</text>
                  </view>
                  <text class="badge result-badge">{{ getAngleLabel(item.angle_type) }}</text>
                </view>
              </view>
              <view class="item-footer">
                <view class="footer-date">
                  <text class="date-icon">📅</text>
                  <text class="date-text">{{ formatDate(item.created_at) }}</text>
                </view>
                <button class="del-btn" @click="deleteItem(item.id)">
                  <text class="del-icon">×</text>
                </button>
              </view>
            </view>
          </view>
          <view v-if="totalPages > 1" class="pagination">
            <button
              class="page-btn"
              :disabled="currentPage === 1 || isLoading"
              @click="goToPage(currentPage - 1)"
            >
              ‹
            </button>
            <text class="page-info">{{ currentPage }} / {{ totalPages }}</text>
            <button
              class="page-btn"
              :disabled="currentPage === totalPages || isLoading"
              @click="goToPage(currentPage + 1)"
            >
              ›
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiClient } from '@/lib/api-client'
import { getMediumImageUrl, getLargeImageUrl } from '@/lib/imageOptimizer'

const props = defineProps<{ embedded?: boolean }>()
const { t } = useI18n()
const mainScrollHeight = inject<() => string>('mainScrollHeight', () => '100%')
const scrollAreaStyle = computed(() => ({ height: mainScrollHeight() }))

interface HistoryItem {
  id: string
  source_tryon_url: string
  result_url: string
  angle_type: string
  angle_params: unknown
  created_at: string
}

const historyItems = ref<HistoryItem[]>([])
const isLoading = ref(false)
const error = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const totalItems = ref(0)
const pageSize = 20

async function loadHistory(page = 1) {
  if (isLoading.value) return
  isLoading.value = true
  error.value = ''
  try {
    const res = await apiClient.get<{
      history: HistoryItem[]
      total: number
      total_pages: number
    }>('/multiangle-history', {
      params: { page: String(page), limit: String(pageSize) },
      timeout: 30000,
    })
    historyItems.value = res.data?.history ?? []
    totalPages.value = res.data?.total_pages ?? 0
    totalItems.value = res.data?.total ?? 0
    currentPage.value = page
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { detail?: string } }; message?: string }
    if (err.response?.status === 401) {
      uni.navigateTo({ url: '/pages/login/login' })
      return
    }
    error.value = err.response?.data?.detail ?? err.message ?? t('common.loadError') ?? 'Load failed'
  } finally {
    isLoading.value = false
  }
}

async function deleteItem(id: string) {
  const { confirm } = await new Promise<{ confirm: boolean }>((resolve) => {
    uni.showModal({
      title: '',
      content: t('multiAngleHistory.deleteConfirm'),
      success: (res) => resolve({ confirm: res.confirm }),
    })
  })
  if (!confirm) return
  try {
    await apiClient.delete(`/multiangle-history/${id}`)
    historyItems.value = historyItems.value.filter((item) => item.id !== id)
    totalItems.value--
  } catch (e) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    uni.showToast({ title: err.response?.data?.detail ?? err.message ?? 'Delete failed', icon: 'none' })
  }
}

function viewInMultiAngle(sourceUrl: string) {
  uni.navigateTo({ url: '/pages/multi-angle/multi-angle?sourceImage=' + encodeURIComponent(sourceUrl) })
}

function previewImage(url: string) {
  if (!url) return
  const resolvedUrl = getLargeImageUrl(url) || url
  uni.previewImage({ urls: [resolvedUrl], current: resolvedUrl })
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getAngleLabel(angleType: string): string {
  const labels: Record<string, string> = {
    front: t('multiAngle.front'),
    left: t('multiAngle.left'),
    right: t('multiAngle.right'),
    back: t('multiAngle.back'),
    top: t('multiAngle.top'),
    custom: t('multiAngle.custom'),
  }
  return labels[angleType] ?? angleType
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) loadHistory(page)
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
}

function goToMultiAngle() {
  uni.navigateTo({ url: '/pages/multi-angle/multi-angle' })
}

onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/multiangle-history/multiangle-history') })
    return
  }
  loadHistory(1)
})

onMounted(() => {
  if (props.embedded) loadHistory(1)
})
</script>

<style scoped>
.page { min-height: 100vh; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
.page-embedded { min-height: 0; height: 100%; overflow: hidden; }
.scroll-area { width: 100%; }
.main { padding: 24rpx 24rpx 32rpx; max-width: 1200rpx; margin: 0 auto; }
.loading-wrap { padding: 96rpx 0; display: flex; flex-direction: column; align-items: center; }
.spinner { width: 64rpx; height: 64rpx; border: 4rpx solid rgba(236,72,153,0.3); border-top-color: #ec4899; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 28rpx; color: #be185d; font-weight: 500; margin-top: 24rpx; }
.error-wrap { padding: 64rpx 0; text-align: center; }
.error-text { font-size: 28rpx; color: #dc2626; }
.empty-section { padding: 48rpx 0; }
.empty-card { background: #fff; padding: 64rpx 48rpx; border-radius: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); border: 1rpx solid rgba(236,72,153,0.3); text-align: center; }
.empty-icon { font-size: 96rpx; display: block; margin-bottom: 24rpx; color: #f9a8d4; }
.empty-title { font-size: 30rpx; color: #374151; font-weight: 500; display: block; margin-bottom: 8rpx; }
.empty-desc { font-size: 26rpx; color: #ec4899; display: block; margin-bottom: 32rpx; }
.btn-go { display: inline-flex; align-items: center; gap: 12rpx; padding: 20rpx 32rpx; background: linear-gradient(90deg, #ec4899, #a855f7); color: #fff; border-radius: 16rpx; font-size: 28rpx; font-weight: 500; }
.btn-icon { font-size: 32rpx; }
.history-section { }
.history-card { background: #fff; padding: 32rpx; border-radius: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); border: 1rpx solid rgba(236,72,153,0.3); }
.section-header { margin-bottom: 32rpx; }
.section-title { font-size: 36rpx; font-weight: 600; color: #be185d; }
.grid { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 24rpx; }
.item-card { width: 48%; flex-shrink: 0; box-sizing: border-box; background: #fff; border-radius: 24rpx; border: 1rpx solid rgba(236,72,153,0.3); overflow: hidden; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.images-row { display: flex; }
.half { flex: 1; aspect-ratio: 1; position: relative; background: #f3f4f6; }
.half-img { width: 100%; height: 100%; }
.half-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; opacity: 0; }
.half:active .half-overlay { opacity: 1; }
.overlay-btn { padding: 12rpx 24rpx; background: rgba(255,255,255,0.9); color: #111827; border-radius: 12rpx; font-size: 24rpx; font-weight: 500; }
.overlay-text { color: #fff; font-size: 26rpx; font-weight: 500; }
.badge { position: absolute; padding: 8rpx 16rpx; border-radius: 8rpx; font-size: 22rpx; }
.source-badge { top: 16rpx; left: 16rpx; background: rgba(0,0,0,0.5); color: #fff; }
.result-badge { top: 16rpx; right: 16rpx; background: linear-gradient(90deg, #ec4899, rgba(168,85,247,0.9)); color: #fff; }
.item-footer { padding: 24rpx; display: flex; align-items: center; justify-content: space-between; }
.footer-date { display: flex; align-items: center; gap: 8rpx; }
.date-icon { font-size: 28rpx; }
.date-text { font-size: 24rpx; color: #f9a8d4; }
.del-btn { width: 56rpx; height: 56rpx; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: transparent; color: #f9a8d4; }
.del-icon { font-size: 40rpx; }
.pagination { margin-top: 48rpx; display: flex; align-items: center; justify-content: center; gap: 24rpx; }
.page-btn { padding: 16rpx 32rpx; border: 1rpx solid rgba(236,72,153,0.4); border-radius: 16rpx; font-size: 28rpx; color: #be185d; font-weight: 500; }
.page-btn:disabled { opacity: 0.5; }
.page-info { padding: 0 16rpx; font-size: 26rpx; color: #be185d; font-weight: 500; }
</style>
