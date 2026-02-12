<template>
  <view class="page">
    <view class="mb-6">
      <text class="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block">{{ t('favorites.title') }}</text>
    </view>
    <z-paging
      ref="pagingRef"
      v-model="favorites"
      :fixed="false"
      :auto="true"
      :default-page-size="100"
      @query="queryList"
    >
      <view class="grid">
        <view v-for="(favorite, index) in favorites" :key="favorite.id" class="card">
          <view class="card-img-wrap" @click="previewImage(index)">
            <image
              v-if="favorite.image_url"
              :src="getThumbnailUrl(favorite.image_url)"
              class="card-img"
              mode="aspectFill"
            />
          </view>
          <view class="card-body">
            <text class="card-date">{{ formatDate(favorite.created_at) }}</text>
            <text v-if="favorite.garment_urls?.length" class="card-meta">{{ favorite.garment_urls.length }} {{ t('favorites.items') }}</text>
            <text v-if="favorite.background_image_url" class="card-meta bg">{{ t('favorites.includesBackground') }}</text>
            <view class="card-actions">
              <button size="mini" class="btnRestore" @click.stop="restoreFavorite(favorite)">{{ t('favorites.restoreToTryOn') }}</button>
              <button size="mini" class="btnDel" @click.stop="deleteFavorite(favorite.id)">{{ t('favorites.delete') }}</button>
            </view>
          </view>
        </view>
      </view>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiClient } from '@/lib/api-client'
import { getThumbnailUrl, getLargeImageUrl } from '@/lib/imageOptimizer'

const props = defineProps<{ embedded?: boolean }>()
const { t } = useI18n()

const switchToStudio = inject<(() => void) | undefined>('switchToStudio')

interface Favorite {
  id: string
  image_url: string
  title?: string
  garment_urls?: string[]
  background_image_url?: string
  prompt?: string
  model_image_url?: string
  model_image_id?: string
  created_at: string
}

const favorites = ref<Favorite[]>([])
const pagingRef = ref<any>(null)

const CACHE_KEY = 'favorites_cache'

function saveFavoritesToCache() {
  try {
    uni.setStorageSync(CACHE_KEY, JSON.stringify(favorites.value))
  } catch (e) {
    console.warn('[Favorites] Failed to save cache', e)
  }
}

function restoreFavoritesFromCache(): boolean {
  try {
    const cached = uni.getStorageSync(CACHE_KEY)
    if (cached) {
      const items = JSON.parse(cached)
      if (Array.isArray(items) && items.length > 0) {
        favorites.value = items
        return true
      }
    }
  } catch (e) {
    console.warn('[Favorites] Failed to restore cache', e)
  }
  return false
}

async function queryList(pageNo: number, _pageSize: number) {
  // 非首页不再加载（收藏无分页，一次全量加载）
  if (pageNo > 1) {
    pagingRef.value?.complete([])
    return
  }
  try {
    const response = await apiClient.get<{ favorites: Favorite[] }>('/favorites', { timeout: 30000 })
    const items = response.data?.favorites ?? []
    saveFavoritesToCache()
    pagingRef.value?.complete(items)
  } catch (e: unknown) {
    const err = e as { response?: { status: number } }
    if (err.response?.status === 401 && favorites.value.length > 0) {
      // 有缓存，不报错
      pagingRef.value?.complete([])
      return
    }
    pagingRef.value?.complete(false)
  }
}

async function deleteFavorite(favoriteId: string) {
  const { confirm: ok } = await new Promise<{ confirm: boolean }>((resolve) => {
    uni.showModal({
      title: '',
      content: t('favorites.deleteConfirm'),
      success: (res) => resolve({ confirm: res.confirm }),
    })
  })
  if (!ok) return
  try {
    await apiClient.delete(`/favorites/${favoriteId}`)
    // 删除后刷新
    pagingRef.value?.reload()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } }; message?: string }
    uni.showToast({ title: err.response?.data?.detail ?? err.message ?? 'Delete failed', icon: 'none' })
  }
}

function previewImage(index: number) {
  const urls = favorites.value.map((f) => getLargeImageUrl(f.image_url)).filter(Boolean)
  if (urls.length === 0) return
  uni.previewImage({ urls, current: urls[index] ?? urls[0] })
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
        return diffMinutes <= 1 ? 'just now' : `${diffMinutes} min ago`
      }
      return `${diffHours} h ago`
    }
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateString
  }
}

function restoreFavorite(favorite: Favorite) {
  try {
    const restoreData = {
      tryonHistoryId: favorite.id,
      image_url: favorite.image_url,
      garment_urls: favorite.garment_urls ?? [],
      background_image_url: favorite.background_image_url,
      prompt: favorite.prompt,
      model_image_url: favorite.model_image_url,
      model_image_id: favorite.model_image_id,
      created_at: favorite.created_at,
    }
    uni.setStorageSync('tryon_history_restore', JSON.stringify(restoreData))
    if (switchToStudio) {
      switchToStudio()
    } else {
      uni.navigateTo({ url: '/pages/studio/studio' })
    }
  } catch (e) {
    console.error('Restore favorite failed', e)
    uni.showToast({ title: t('favorites.restoreFailed'), icon: 'none' })
  }
}

onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/favorites/favorites') })
    return
  }
  restoreFavoritesFromCache()
  pagingRef.value?.reload()
})
</script>

<style scoped>
.page { padding: 24rpx; min-height: 100%; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
.grid { display: flex; flex-wrap: wrap; gap: 24rpx; padding-bottom: 24rpx; }
.card { width: calc(50% - 12rpx); background: #fff; border-radius: 24rpx; overflow: hidden; border: 1rpx solid rgba(236, 72, 153, 0.2); box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.card-img-wrap { width: 100%; aspect-ratio: 1; background: #f9fafb; }
.card-img { width: 100%; height: 100%; }
.card-body { padding: 20rpx; }
.card-date { font-size: 22rpx; color: #ec4899; display: block; margin-bottom: 8rpx; }
.card-meta { font-size: 22rpx; color: #be185d; display: block; margin-bottom: 4rpx; }
.card-meta.bg { color: #a855f7; }
.card-actions { display: flex; gap: 16rpx; margin-top: 16rpx; }
.btnRestore { flex: 1; font-size: 24rpx; border: 1rpx solid #ec4899; color: #ec4899; border-radius: 12rpx; }
.btnDel { font-size: 24rpx; background: #ef4444; color: #fff; border-radius: 12rpx; }
</style>
