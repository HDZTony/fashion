<template>
  <view class="p-6 min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
    <view class="mb-6">
      <text class="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent block">{{ t('favorites.title') }}</text>
    </view>
    <view v-if="isLoading" class="py-12 text-center text-pink-600">
      <text class="loading-text">{{ t('favorites.loading') }}</text>
    </view>
    <view v-else-if="error" class="py-6 text-center text-red-600">
      <text class="error-text">{{ error }}</text>
    </view>
    <view v-else-if="favorites.length === 0" class="text-center py-20">
      <text class="empty-icon">❤</text>
      <text class="empty-title">{{ t('favorites.noFavorites') }}</text>
      <text class="empty-desc">{{ t('favorites.noFavoritesDesc') }}</text>
    </view>
    <scroll-view v-else scroll-y class="list">
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
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
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
const isLoading = ref(false)
const error = ref('')

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

async function loadFavorites() {
  if (isLoading.value) return
  isLoading.value = true
  error.value = ''
  try {
    const response = await apiClient.get<{ favorites: Favorite[] }>('/favorites', { timeout: 30000 })
    favorites.value = response.data?.favorites ?? []
    saveFavoritesToCache()
  } catch (e: unknown) {
    const err = e as { response?: { status: number; data?: { detail?: string } }; message?: string }
    const detail = err.response?.data?.detail ?? err.message ?? 'Failed to load favorites'
    if (err.response?.status === 401 && favorites.value.length > 0) {
      error.value = ''
      return
    }
    if (favorites.value.length === 0) error.value = detail
  } finally {
    isLoading.value = false
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
    await loadFavorites()
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
  loadFavorites()
})

onMounted(() => {
  if (props.embedded) {
    restoreFavoritesFromCache()
    loadFavorites()
  }
})
</script>

<style scoped>
.page { padding: 24rpx; min-height: 100%; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
.header { margin-bottom: 24rpx; }
.title { font-size: 40rpx; font-weight: 700; background: linear-gradient(90deg, #ec4899, #a855f7); -webkit-background-clip: text; background-clip: text; color: transparent; }
.loading-wrap, .error-wrap { padding: 48rpx; text-align: center; }
.loading-text { color: #be185d; font-size: 28rpx; }
.error-text { color: #dc2626; font-size: 28rpx; }
.empty { padding: 48rpx; text-align: center; }
.empty-icon { font-size: 80rpx; display: block; margin-bottom: 16rpx; }
.empty-title { font-size: 30rpx; font-weight: 500; color: #374151; display: block; margin-bottom: 8rpx; }
.empty-desc { font-size: 24rpx; color: #ec4899; display: block; }
.list { height: calc(100vh - 200rpx); }
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
