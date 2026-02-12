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
    <z-paging
      ref="pagingRef"
      v-model="historyItems"
      :fixed="false"
      :auto="true"
      :default-page-size="pageSize"
      :style="embedded ? scrollAreaStyle : {}"
      @query="queryList"
    >
      <view class="main">
        <view v-if="totalItems > 0" class="section-header">
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
      </view>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
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
const pagingRef = ref<any>(null)
const pageSize = 20
const totalItems = ref(0)

async function queryList(pageNo: number, pageSize: number) {
  try {
    const res = await apiClient.get<{
      history: HistoryItem[]
      total: number
      total_pages: number
    }>('/multiangle-history', {
      params: { page: String(pageNo), limit: String(pageSize) },
      timeout: 30000,
    })
    totalItems.value = res.data?.total ?? 0
    pagingRef.value?.complete(res.data?.history ?? [])
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } }
    if (err.response?.status === 401) {
      uni.navigateTo({ url: '/pages/login/login' })
      return
    }
    pagingRef.value?.complete(false)
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
    // 删除后刷新列表
    pagingRef.value?.reload()
  } catch (e: unknown) {
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

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
}

onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/multiangle-history/multiangle-history') })
    return
  }
  pagingRef.value?.reload()
})
</script>

<style scoped>
.page { min-height: 100vh; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
.page-embedded { min-height: 0; height: 100%; overflow: hidden; }
.main { padding: 24rpx 24rpx 32rpx; max-width: 1200rpx; margin: 0 auto; }
.section-header { margin-bottom: 24rpx; }
.section-title { font-size: 26rpx; color: #be185d; font-weight: 500; }
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
</style>
