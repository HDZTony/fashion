<template>
  <view class="page">
    <wd-navbar
      :title="t('blog.title')"
      fixed
      placeholder
      safe-area-inset-top
      bordered
      :right-text="hasToken ? t('blog.create') : ''"
      @click-right="goToCreate"
    />
    <view v-if="isLoading" class="loading-wrap">
      <text class="loading-text">{{ t('blog.loading') }}</text>
    </view>
    <view v-else-if="error" class="error-wrap">
      <text class="error-text">{{ error }}</text>
    </view>
    <view v-else-if="posts.length === 0" class="empty">
      <text class="empty-desc">{{ t('blog.noPosts') }}</text>
    </view>
    <scroll-view v-else scroll-y class="list" :style="{ height: listScrollHeight }" @scrolltolower="loadMore">
      <view class="grid">
        <view
          v-for="post in posts"
          :key="post.id"
          class="card"
          @click="goToPost(post.id)"
        >
          <view class="card-media">
            <image
              v-if="getFirstMediaUrl(post).url"
              :src="getFirstMediaUrl(post).url"
              class="card-img"
              mode="aspectFill"
            />
            <view v-else-if="getFirstMediaUrl(post).isYoutube" class="card-media youtube-wrap">
              <image
                v-if="getFirstMediaUrl(post).thumb"
                :src="getFirstMediaUrl(post).thumb"
                class="card-img"
                mode="aspectFill"
              />
              <view class="play-overlay"><text class="play-icon">▶</text></view>
            </view>
            <view v-else class="card-media-placeholder">
              <text class="placeholder-icon">📄</text>
            </view>
          </view>
          <view class="card-body">
            <text class="card-title">{{ post.title }}</text>
            <view v-if="post.tags?.length" class="card-tags">
              <text v-for="tag in post.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</text>
            </view>
          </view>
        </view>
      </view>
      <view v-if="posts.length > 0 && hasMore" class="load-more">
        <button class="btnLoadMore" :disabled="isLoadingMore" @click="loadMore">
          {{ isLoadingMore ? t('common.loading') : t('blog.loadMore') }}
        </button>
      </view>
    </scroll-view>
    <!-- 接口调试信息：始终显示 -->
    <view class="debug-section">
      <view class="debug-header" @click="debugExpanded = !debugExpanded">
        <text class="debug-title">接口调试</text>
        <text class="debug-count">{{ apiLogs.length }} 条</text>
        <text class="debug-toggle">{{ debugExpanded ? '▼' : '▶' }}</text>
      </view>
      <view v-if="debugExpanded" class="debug-body">
        <button class="btnClear" @click.stop="clearApiLogs">清空</button>
        <view v-if="apiLogs.length === 0" class="debug-empty">暂无请求记录</view>
        <view v-else class="debug-list">
          <view v-for="log in apiLogs" :key="log.id" class="debug-item" :class="{ 'debug-error': log.status === 'error' || (typeof log.status === 'number' && log.status >= 400) }">
            <view class="debug-row">
              <text class="debug-method">{{ log.method }}</text>
              <text class="debug-status">{{ log.status }}</text>
              <text class="debug-duration">{{ log.duration }}ms</text>
              <text class="debug-time">{{ log.time }}</text>
            </view>
            <text class="debug-url">{{ log.url }}</text>
            <text v-if="log.preview" class="debug-preview">{{ log.preview }}</text>
          </view>
        </view>
      </view>
    </view>
    <CustomTabBar current-tab="blog" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import CustomTabBar from '@/components/CustomTabBar.vue'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import { getApiLogs, clearApiLogs as doClearApiLogs } from '@/lib/apiDebug'

const { t } = useI18n()
const apiLogs = getApiLogs()
const debugExpanded = ref(false)

function clearApiLogs() {
  doClearApiLogs()
}

interface MediaItem {
  url: string
  type: 'image' | 'video' | 'youtube'
  thumbnail?: string
}

interface BlogPost {
  id: string
  title: string
  content: string
  tags: string[]
  status: 'draft' | 'published'
  media_urls?: MediaItem[]
  created_at: string
  updated_at: string
  user_id: string
}

const posts = ref<BlogPost[]>([])
const isLoading = ref(false)
const isLoadingMore = ref(false)
const error = ref('')
const hasMore = ref(true)
const offset = ref(0)
const limit = 20
const hasToken = ref(false)

// Android 上 scroll-view 需要明确高度
const sysInfo = ref<UniApp.GetSystemInfoSyncResult | null>(uni.getSystemInfoSync())
const listScrollHeight = computed(() => {
  const s = sysInfo.value
  if (!s) return 'calc(100vh - 120rpx - 50px)'
  const winH = s.windowHeight ?? s.screenHeight ?? 0
  const safeBottom = (s as { safeAreaInsets?: { bottom?: number } }).safeAreaInsets?.bottom ?? 0
  const navbarH = 44
  const tabBarH = 50
  const padding = 60
  const h = winH - navbarH - tabBarH - safeBottom - padding
  return `${Math.max(200, h)}px`
})

function getFirstMediaUrl(post: BlogPost): { url: string; thumb?: string; isYoutube?: boolean } {
  const media = post.media_urls?.[0]
  if (!media) return { url: '' }
  if (media.type === 'image') return { url: media.url }
  if (media.type === 'youtube') return { url: '', thumb: media.thumbnail, isYoutube: true }
  return { url: media.thumbnail ?? media.url }
}

async function loadPosts(reset = false) {
  if (reset) {
    offset.value = 0
    posts.value = []
    hasMore.value = true
  }
  if (isLoading.value || isLoadingMore.value) return
  if (reset) isLoading.value = true
  else isLoadingMore.value = true
  error.value = ''
  try {
    const response = await apiClient.get<{ posts: BlogPost[] }>('/blog/posts', {
      params: { limit, offset: offset.value, status: 'published' },
      timeout: 30000,
    })
    const newPosts = response.data?.posts ?? []
    if (reset) posts.value = newPosts
    else posts.value.push(...newPosts)
    hasMore.value = newPosts.length === limit
    offset.value += newPosts.length
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    error.value = err.response?.data?.error ?? err.message ?? t('blog.loadError')
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

function loadMore() {
  if (!hasMore.value || isLoadingMore.value) return
  loadPosts(false)
}

function goToPost(id: string) {
  uni.navigateTo({ url: '/pages/blog-detail/blog-detail?id=' + encodeURIComponent(id) })
}

function goToCreate() {
  if (!hasToken.value) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/blog-create/blog-create') })
    return
  }
  uni.navigateTo({ url: '/pages/blog-create/blog-create' })
}

onShow(() => {
  sysInfo.value = uni.getSystemInfoSync()
  hasToken.value = !!uni.getStorageSync('auth_token')
})

onMounted(() => {
  hasToken.value = !!uni.getStorageSync('auth_token')
  loadPosts(true)
})
</script>

<style scoped>
.page { padding: 24rpx; padding-bottom: calc(24rpx + 50px + env(safe-area-inset-bottom)); min-height: 100vh; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
.btnCreate { padding: 16rpx 32rpx; background: linear-gradient(90deg, #ec4899, #a855f7); color: #fff; border-radius: 16rpx; font-size: 28rpx; }
.loading-wrap, .error-wrap { padding: 48rpx; text-align: center; }
.loading-text { color: #be185d; font-size: 28rpx; }
.error-text { color: #dc2626; font-size: 28rpx; }
.empty { padding: 48rpx; text-align: center; }
.empty-desc { font-size: 28rpx; color: #6b7280; }
.list { height: calc(100vh - var(--window-top, 0px) - 120rpx - 50px - env(safe-area-inset-bottom)); }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24rpx; padding-bottom: 24rpx; }
.card { width: 100%; background: #fff; border-radius: 24rpx; overflow: hidden; border: 1rpx solid rgba(236, 72, 153, 0.2); box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.card-media { width: 100%; height: 280rpx; background: #f3f4f6; position: relative; }
.card-img { width: 100%; height: 100%; }
.card-media-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.youtube-wrap { position: relative; }
.play-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); }
.play-icon { font-size: 64rpx; color: #fff; }
.placeholder-icon { font-size: 64rpx; }
.card-body { padding: 20rpx; }
.card-title { font-size: 30rpx; font-weight: 600; color: #111827; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 12rpx; }
.tag { padding: 4rpx 12rpx; border-radius: 999rpx; background: rgba(236, 72, 153, 0.1); color: #be185d; font-size: 22rpx; }
.load-more { padding: 24rpx; text-align: center; }
.btnLoadMore { padding: 20rpx 40rpx; border: 1rpx solid rgba(236, 72, 153, 0.3); border-radius: 16rpx; color: #be185d; font-size: 28rpx; }
.debug-section { margin-top: 24rpx; background: #1e1e2e; border-radius: 16rpx; overflow: hidden; }
.debug-header { padding: 20rpx 24rpx; display: flex; align-items: center; gap: 16rpx; background: #2d2d3d; }
.debug-title { font-size: 26rpx; font-weight: 600; color: #a5b4fc; }
.debug-count { font-size: 24rpx; color: #94a3b8; }
.debug-toggle { margin-left: auto; font-size: 24rpx; color: #94a3b8; }
.debug-body { padding: 20rpx; max-height: 400rpx; overflow-y: auto; }
.btnClear { padding: 8rpx 20rpx; font-size: 24rpx; color: #94a3b8; background: #374151; border-radius: 8rpx; margin-bottom: 16rpx; }
.debug-empty { font-size: 24rpx; color: #64748b; text-align: center; padding: 24rpx; }
.debug-list { display: flex; flex-direction: column; gap: 16rpx; }
.debug-item { padding: 16rpx; background: #27272a; border-radius: 12rpx; border-left: 4rpx solid #22c55e; }
.debug-item.debug-error { border-left-color: #ef4444; }
.debug-row { display: flex; align-items: center; gap: 16rpx; flex-wrap: wrap; margin-bottom: 8rpx; }
.debug-method { font-size: 22rpx; font-weight: 600; color: #60a5fa; }
.debug-status { font-size: 22rpx; color: #22c55e; }
.debug-item.debug-error .debug-status { color: #ef4444; }
.debug-duration { font-size: 22rpx; color: #fbbf24; }
.debug-time { font-size: 22rpx; color: #64748b; }
.debug-url { font-size: 22rpx; color: #94a3b8; display: block; word-break: break-all; }
.debug-preview { font-size: 20rpx; color: #64748b; display: block; margin-top: 8rpx; word-break: break-all; }
</style>
