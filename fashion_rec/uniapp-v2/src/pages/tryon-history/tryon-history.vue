<template>
  <view class="page" :class="{ 'page-embedded': embedded }">
    <wd-navbar
      v-if="!embedded"
      :title="t('history.title')"
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
        <view v-if="totalItems > 0" class="stats">
          {{ t('history.showing') }} {{ historyItems.length }} {{ t('history.of') }} {{ totalItems }} {{ t('history.items') }}
        </view>
        <view class="grid">
          <view
            v-for="(item, index) in historyItems"
            :key="item.id"
            class="card"
            @click="openPreview(index)"
          >
            <view class="card-image-wrap">
              <image
                v-if="item.image_url"
                :src="getMediumImageUrl(item.image_url)"
                class="card-image"
                mode="aspectFill"
              />
              <view class="days-badge">
                {{ t('history.expiresIn') }} {{ getDaysRemaining(item.expires_at) }} {{ t('history.days') }}
              </view>
            </view>
            <view class="card-body">
              <view class="card-top">
                <view class="card-meta">
                  <text class="meta-date">{{ formatDate(item.created_at) }}</text>
                  <text v-if="item.garment_urls?.length" class="meta-garments">{{ item.garment_urls.length }} {{ t('history.items') }}</text>
                  <text v-if="item.background_image_url" class="meta-bg">{{ t('history.includesBackground') }}</text>
                </view>
                <view class="card-actions">
                  <button class="btn-icon restore" @click.stop="restoreTryOnHistory(item)" :title="t('history.restoreToFitting')">
                    ↺
                  </button>
                  <button class="btn-icon delete" @click.stop="deleteHistoryItem(item.id)" :title="t('history.clearHistory')">
                    ×
                  </button>
                </view>
              </view>
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
const switchToStudio = inject<(() => void) | undefined>('switchToStudio')
const mainScrollHeight = inject<() => string>('mainScrollHeight', () => '100%')
const scrollAreaStyle = computed(() => ({ height: mainScrollHeight() }))

interface TryOnHistoryItem {
  id: string
  image_url: string
  garment_urls?: string[]
  background_image_url?: string
  prompt?: string
  model_image_url?: string
  created_at: string
  expires_at: string
}

const historyItems = ref<TryOnHistoryItem[]>([])
const pagingRef = ref<any>(null)
const pageSize = 20
const totalItems = ref(0)

async function queryList(pageNo: number, pageSize: number) {
  try {
    const res = await apiClient.get<{
      history: TryOnHistoryItem[]
      total: number
      page: number
      total_pages: number
    }>('/tryon-history', {
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

async function deleteHistoryItem(historyId: string) {
  const { confirm } = await new Promise<{ confirm: boolean }>((resolve) => {
    uni.showModal({
      title: '',
      content: t('history.deleteConfirm'),
      success: (res) => resolve({ confirm: res.confirm }),
    })
  })
  if (!confirm) return
  try {
    await apiClient.delete(`/tryon-history/${historyId}`)
    // 删除后刷新列表
    pagingRef.value?.reload()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    uni.showToast({ title: err.response?.data?.detail ?? err.message ?? 'Delete failed', icon: 'none' })
  }
}

function openPreview(index: number) {
  const urls = historyItems.value
    .map((item) => item.image_url)
    .filter((url): url is string => !!url)
  if (urls.length === 0) return
  const resolvedUrls = urls.map((u) => getLargeImageUrl(u) || u)
  uni.previewImage({ urls: resolvedUrls, current: resolvedUrls[index] ?? resolvedUrls[0] })
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`
      }
      return `${diffHours} hours ago`
    } else if (diffDays === 1) {
      return 'yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

function getDaysRemaining(expiresAt: string): number {
  try {
    const expiresDate = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiresDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  } catch {
    return 0
  }
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
}

function restoreTryOnHistory(item: TryOnHistoryItem) {
  try {
    const restoreData = {
      tryonHistoryId: item.id,
      image_url: item.image_url,
      garment_urls: item.garment_urls || [],
      background_image_url: item.background_image_url,
      prompt: item.prompt,
      model_image_url: item.model_image_url,
      created_at: item.created_at,
    }
    uni.setStorageSync('tryon_history_restore', JSON.stringify(restoreData))
    if (props.embedded && switchToStudio) {
      switchToStudio()
    } else {
      uni.navigateTo({ url: '/pages/studio/studio?tryonHistoryId=' + encodeURIComponent(item.id) })
    }
  } catch {
    uni.showToast({ title: t('history.restoreFailed'), icon: 'none' })
  }
}

onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/tryon-history/tryon-history') })
    return
  }
  pagingRef.value?.reload()
})
</script>

<style scoped>
.page { min-height: 100vh; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
.page-embedded { min-height: 0; height: 100%; overflow: hidden; }
.main { padding: 24rpx 24rpx 32rpx; max-width: 1200rpx; margin: 0 auto; }
.stats { font-size: 26rpx; color: #be185d; font-weight: 500; margin-bottom: 24rpx; }
.grid { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 24rpx; }
.card { width: 48%; flex-shrink: 0; box-sizing: border-box; background: #fff; border: 1rpx solid rgba(236,72,153,0.3); border-radius: 24rpx; overflow: hidden; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.card-image-wrap { position: relative; width: 100%; aspect-ratio: 1; background: #f3f4f6; }
.card-image { width: 100%; height: 100%; }
.days-badge { position: absolute; top: 16rpx; right: 16rpx; padding: 8rpx 16rpx; background: linear-gradient(90deg, #ec4899, rgba(168,85,247,0.9)); color: #fff; font-size: 22rpx; border-radius: 999rpx; font-weight: 500; }
.card-body { padding: 24rpx; }
.card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; }
.card-meta { flex: 1; min-width: 0; }
.meta-date { font-size: 24rpx; color: #f9a8d4; display: block; margin-bottom: 4rpx; }
.meta-garments { font-size: 24rpx; color: #ec4899; display: block; }
.meta-bg { font-size: 24rpx; color: #ec4899; display: block; margin-top: 8rpx; }
.card-actions { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; }
.btn-icon { width: 56rpx; height: 56rpx; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36rpx; background: transparent; color: #f9a8d4; }
.btn-icon.restore { font-size: 32rpx; }
.btn-icon.delete { color: #f9a8d4; }
</style>
