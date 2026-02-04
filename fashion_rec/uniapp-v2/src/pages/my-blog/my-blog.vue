<template>
  <view class="p-6 min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
    <wd-navbar
      v-if="!embedded"
      :title="t('blog.myBlog')"
      :right-text="t('blog.create')"
      fixed
      placeholder
      safe-area-inset-top
      bordered
      @click-right="openCreate"
    />
    <view v-if="isLoading" class="py-12 text-center text-pink-600">
      <text class="loading-text">{{ t('blog.loading') }}</text>
    </view>
    <view v-else-if="error" class="error-wrap">
      <text class="error-text">{{ error }}</text>
    </view>
    <view v-else-if="posts.length === 0" class="text-center py-20">
      <text class="text-sm text-gray-500 block mb-4">{{ t('blog.noPosts') }}</text>
      <button class="py-4 px-8 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-2xl text-sm" @click="openCreate">{{ t('blog.create') }}</button>
    </view>
    <scroll-view v-else scroll-y class="list" @scrolltolower="loadMore">
      <view class="grid">
        <view v-for="post in posts" :key="post.id" class="card">
          <view class="card-media" @click="goToPost(post.id)">
            <image
              v-if="getFirstMediaUrl(post)"
              :src="getFirstMediaUrl(post)"
              class="card-img"
              mode="aspectFill"
            />
            <view v-else class="card-media-placeholder">
              <text class="placeholder-icon">📄</text>
            </view>
            <view class="card-badge" :class="post.status === 'published' ? 'published' : 'draft'">
              {{ post.status === 'published' ? t('blog.published') : t('blog.draft') }}
            </view>
          </view>
          <view class="card-body">
            <text class="card-title" @click="goToPost(post.id)">{{ post.title }}</text>
            <view v-if="post.tags?.length" class="card-tags">
              <text v-for="tag in post.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</text>
            </view>
            <view class="card-actions">
              <button size="mini" class="btnEdit" @click.stop="goToEdit(post.id)">{{ t('blog.edit') }}</button>
              <button size="mini" class="btnDel" @click.stop="deletePost(post.id)">{{ t('blog.delete') }}</button>
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
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'

const props = defineProps<{ embedded?: boolean }>()
const { t } = useI18n()

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
const currentUserId = ref<string | null>(null)

function getFirstMediaUrl(post: BlogPost): string {
  const media = post.media_urls?.[0]
  if (!media) return ''
  if (media.type === 'image') return media.url
  return media.thumbnail ?? media.url
}

async function loadPosts(reset = false) {
  if (!currentUserId.value) {
    error.value = 'Please sign in to view your blog posts'
    return
  }
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
      params: { limit, offset: offset.value, user_id: currentUserId.value },
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

function goToEdit(id: string) {
  uni.navigateTo({ url: '/pages/blog-create/blog-create?id=' + encodeURIComponent(id) })
}

function openCreate() {
  uni.navigateTo({ url: '/pages/blog-create/blog-create' })
}

async function deletePost(id: string) {
  const { confirm: ok } = await new Promise<{ confirm: boolean }>((resolve) => {
    uni.showModal({
      title: '',
      content: t('blog.deleteConfirm'),
      success: (res) => resolve({ confirm: res.confirm }),
    })
  })
  if (!ok) return
  try {
    await apiClient.delete(`/blog/posts/${id}`)
    posts.value = posts.value.filter((p) => p.id !== id)
    uni.showToast({ title: t('blog.deleteSuccess'), icon: 'success' })
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    uni.showToast({ title: err.response?.data?.error ?? err.message ?? t('blog.deleteError'), icon: 'none' })
  }
}

onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/my-blog/my-blog') })
    return
  }
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      currentUserId.value = user.id
      loadPosts(true)
    } else {
      error.value = 'Please sign in to view your blog posts'
    }
  })
})

onMounted(() => {
  if (props.embedded) {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        currentUserId.value = user.id
        loadPosts(true)
      } else {
        error.value = 'Please sign in to view your blog posts'
      }
    })
  }
})
</script>

<style scoped>
.page { padding: 24rpx; min-height: 100%; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24rpx; }
.title { font-size: 40rpx; font-weight: 700; background: linear-gradient(90deg, #ec4899, #a855f7); -webkit-background-clip: text; background-clip: text; color: transparent; }
.btnCreate { padding: 16rpx 32rpx; background: linear-gradient(90deg, #ec4899, #a855f7); color: #fff; border-radius: 16rpx; font-size: 28rpx; }
.loading-wrap, .error-wrap { padding: 48rpx; text-align: center; }
.loading-text { color: #be185d; font-size: 28rpx; }
.error-text { color: #dc2626; font-size: 28rpx; }
.empty { padding: 48rpx; text-align: center; }
.empty-desc { font-size: 28rpx; color: #6b7280; display: block; margin-bottom: 24rpx; }
.list { height: calc(100vh - var(--window-top, 0px) - 200rpx); }
.grid { display: flex; flex-wrap: wrap; gap: 24rpx; padding-bottom: 24rpx; }
.card { width: calc(50% - 12rpx); background: #fff; border-radius: 24rpx; overflow: hidden; border: 1rpx solid rgba(236, 72, 153, 0.2); box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.card-media { width: 100%; height: 240rpx; background: #f3f4f6; position: relative; }
.card-img { width: 100%; height: 100%; }
.card-media-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.placeholder-icon { font-size: 64rpx; }
.card-badge { position: absolute; top: 16rpx; right: 16rpx; padding: 8rpx 16rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 600; }
.card-badge.published { background: rgba(34, 197, 94, 0.2); color: #15803d; }
.card-badge.draft { background: rgba(234, 179, 8, 0.2); color: #a16207; }
.card-body { padding: 20rpx; }
.card-title { font-size: 30rpx; font-weight: 600; color: #111827; display: block; margin-bottom: 12rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 12rpx; }
.tag { padding: 4rpx 12rpx; border-radius: 999rpx; background: rgba(236, 72, 153, 0.1); color: #be185d; font-size: 22rpx; }
.card-actions { display: flex; gap: 16rpx; }
.btnEdit { flex: 1; font-size: 24rpx; border: 1rpx solid #ec4899; color: #ec4899; border-radius: 12rpx; }
.btnDel { flex: 1; font-size: 24rpx; background: #fee2e2; color: #dc2626; border-radius: 12rpx; }
.load-more { padding: 24rpx; text-align: center; }
.btnLoadMore { padding: 20rpx 40rpx; border: 1rpx solid rgba(236, 72, 153, 0.3); border-radius: 16rpx; color: #be185d; font-size: 28rpx; }
</style>
