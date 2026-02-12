<template>
  <view class="p-6 min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
    <wd-navbar
      :title="post ? post.title : t('blog.title')"
      :left-text="t('common.back')"
      left-arrow
      fixed
      placeholder
      safe-area-inset-top
      bordered
      @click-left="backToList"
    />
    <view v-if="isLoading" class="py-12 text-center text-pink-600">
      <text>{{ t('blog.loading') }}</text>
    </view>

    <view v-else-if="error" class="py-12 text-center">
      <text class="text-red-600 block">{{ error }}</text>
      <button class="mt-4 text-pink-600 font-medium bg-transparent border-none" @click="backToList">
        {{ t('blog.backToList') }}
      </button>
    </view>

    <scroll-view v-else-if="post" scroll-y class="scroll-area">
      <view class="max-w-[680px] mx-auto pb-16">
        <!-- Header -->
        <view class="mb-12">
          <view class="flex items-start justify-between mb-6">
            <text class="text-4xl font-bold text-gray-900 leading-tight flex-1">{{ post.title }}</text>
            <view v-if="isAuthor" class="ml-6 flex gap-2 shrink-0">
              <button class="px-4 py-2 text-sm border border-pink-200 rounded-xl" @click="goToEdit">
                {{ t('blog.edit') }}
              </button>
              <button
                :disabled="isDeleting"
                class="px-4 py-2 text-sm border border-red-200 text-red-600 rounded-xl disabled:opacity-50"
                @click="handleDelete"
              >
                {{ isDeleting ? t('common.loading') : t('blog.delete') }}
              </button>
            </view>
          </view>
          <view v-if="post.tags?.length" class="flex flex-wrap gap-2">
            <text
              v-for="tag in post.tags"
              :key="tag"
              class="px-3 py-1 text-sm rounded-full bg-pink-50 text-pink-600 font-medium"
            >
              {{ tag }}
            </text>
          </view>
        </view>

        <!-- Media Gallery -->
        <view v-if="post.media_urls?.length" class="mb-12 space-y-6">
          <view v-for="(media, idx) in post.media_urls" :key="idx" class="rounded-xl overflow-hidden">
            <image
              v-if="media.type === 'image'"
              :src="media.url"
              class="w-full h-auto block"
              mode="widthFix"
              @click="previewImage(media.url)"
            />
            <view
              v-else-if="media.type === 'youtube'"
              class="w-full aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center relative"
              @click="openYouTube(media.url)"
            >
              <image
                :src="media.thumbnail || (extractYouTubeVideoId(media.url) ? getYouTubeThumbnail(extractYouTubeVideoId(media.url)!) : '')"
                class="w-full h-full opacity-75"
                mode="aspectFill"
              />
              <view class="absolute inset-0 flex items-center justify-center">
                <view class="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center">
                  <text class="text-white text-2xl ml-1">▶</text>
                </view>
              </view>
            </view>
            <video
              v-else
              :src="media.url"
              :poster="media.thumbnail"
              class="w-full rounded-xl"
              controls
              :show-center-play-btn="true"
              object-fit="contain"
            />
          </view>
        </view>

        <!-- Content (markdown rendered) -->
        <view class="blog-content mb-12">
          <rich-text :nodes="renderedContent" class="prose-content" />
        </view>

        <!-- Comments Section -->
        <view class="border-t border-gray-200 pt-12">
          <text class="text-2xl font-bold text-gray-900 mb-6 block">
            {{ t('blog.comments') }}
            <text v-if="comments.length > 0" class="text-lg font-normal text-gray-500 ml-2">({{ comments.length }})</text>
          </text>

          <!-- Comment Form (authenticated) -->
          <view v-if="isAuthenticated" class="mb-8">
            <view class="bg-gray-50 rounded-xl p-4 border border-pink-200">
              <textarea
                v-model="newComment"
                :placeholder="t('blog.commentPlaceholder')"
                rows="4"
                class="w-full px-4 py-3 border border-pink-200 rounded-xl resize-none box-border"
              />
              <view class="flex justify-end mt-3">
                <button
                  :disabled="!newComment.trim() || isSubmittingComment"
                  class="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="submitComment"
                >
                  {{ isSubmittingComment ? t('common.loading') : t('blog.submitComment') }}
                </button>
              </view>
            </view>
          </view>

          <!-- Login prompt -->
          <view v-else class="mb-8 bg-pink-50 border border-pink-200 rounded-xl p-4 text-center">
            <text class="text-gray-700 block">{{ t('blog.loginToComment') }}</text>
            <button class="mt-2 text-pink-600 font-medium bg-transparent border-none" @click="goToLogin">
              {{ t('nav.login') }}
            </button>
          </view>

          <!-- Comments List -->
          <view v-if="isLoadingComments" class="py-8 text-center text-pink-600">
            <text>{{ t('common.loading') }}</text>
          </view>
          <view v-else-if="comments.length === 0" class="py-12 text-center text-gray-500">
            <text>{{ t('blog.noComments') }}</text>
          </view>
          <view v-else class="space-y-6">
            <view
              v-for="comment in comments"
              :key="comment.id"
              class="bg-white border border-pink-200 rounded-xl p-4"
            >
              <view class="flex items-start justify-between mb-2">
                <view class="flex items-center gap-2">
                  <view class="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
                    <text class="text-white font-semibold text-sm">{{ getUserInitial(comment.user_id) }}</text>
                  </view>
                  <view>
                    <text class="text-sm font-medium text-gray-900 block">{{ getUserDisplayName(comment.user_id) }}</text>
                    <text class="text-xs text-gray-500 block">{{ formatDate(comment.created_at) }}</text>
                  </view>
                </view>
                <button
                  v-if="canDeleteComment(comment)"
                  :disabled="isDeletingComment === comment.id"
                  class="text-red-600 text-sm disabled:opacity-50 bg-transparent border-none"
                  @click="deleteComment(comment.id)"
                >
                  {{ isDeletingComment === comment.id ? t('common.loading') : t('blog.deleteComment') }}
                </button>
              </view>
              <text class="text-gray-700 whitespace-pre-wrap block">{{ comment.content }}</text>
            </view>
          </view>
        </view>

        <!-- Back button -->
        <view class="mt-8">
          <button class="text-pink-600 font-medium bg-transparent border-none flex items-center gap-2" @click="backToList">
            ← {{ t('blog.backToList') }}
          </button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import { extractYouTubeVideoId, getYouTubeThumbnail } from '@/lib/youtube'

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

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

const post = ref<BlogPost | null>(null)
const postId = ref('')
const isLoading = ref(true)
const error = ref('')
const isDeleting = ref(false)
const comments = ref<Comment[]>([])
const isLoadingComments = ref(false)
const newComment = ref('')
const isSubmittingComment = ref(false)
const isDeletingComment = ref<string | null>(null)
const currentUserId = ref<string | null>(null)
const isAuthenticated = ref(false)

const renderedContent = computed(() => {
  if (!post.value?.content) return ''
  try {
    return marked.parse(post.value.content) as string
  } catch {
    return post.value.content
  }
})

const isAuthor = computed(() => {
  return isAuthenticated.value && post.value && currentUserId.value && post.value.user_id === currentUserId.value
})

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getUserDisplayName(userId: string): string {
  if (currentUserId.value && userId === currentUserId.value) return t('blog.you')
  return `User ${userId.substring(0, 8)}`
}

function getUserInitial(userId: string): string {
  return userId.substring(0, 1).toUpperCase()
}

function canDeleteComment(comment: Comment): boolean {
  if (!currentUserId.value) return false
  if (comment.user_id === currentUserId.value) return true
  if (post.value && post.value.user_id === currentUserId.value) return true
  return false
}

onLoad((options?: Record<string, string | undefined>) => {
  postId.value = options?.id ?? ''
  if (!postId.value) {
    error.value = 'Missing post id'
    isLoading.value = false
    return
  }
  loadPost()
})

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    currentUserId.value = user.id
    isAuthenticated.value = true
  }
})

async function loadPost() {
  isLoading.value = true
  error.value = ''
  try {
    const res = await apiClient.get<BlogPost>(`/blog/posts/${postId.value}`, { timeout: 30000 })
    post.value = res.data ?? null
    if (!post.value) {
      error.value = 'Post not found'
    } else if (post.value.status === 'published') {
      loadComments()
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    error.value = err.response?.data?.error ?? (err as { message?: string }).message ?? t('blog.loadError')
  } finally {
    isLoading.value = false
  }
}

async function loadComments() {
  if (!post.value) return
  isLoadingComments.value = true
  try {
    const res = await apiClient.get<{ comments: Comment[] }>(`/blog/posts/${post.value.id}/comments`)
    comments.value = res.data?.comments ?? []
  } catch {
    comments.value = []
  } finally {
    isLoadingComments.value = false
  }
}

async function submitComment() {
  if (!post.value || !newComment.value.trim()) return
  isSubmittingComment.value = true
  try {
    const res = await apiClient.post<Comment>(`/blog/posts/${post.value.id}/comments`, {
      content: newComment.value.trim(),
    })
    comments.value.unshift(res.data)
    newComment.value = ''
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    uni.showToast({
      title: err.response?.data?.error ?? (err as { message?: string }).message ?? t('blog.commentError'),
      icon: 'none',
    })
  } finally {
    isSubmittingComment.value = false
  }
}

async function deleteComment(commentId: string) {
  const { confirm } = await new Promise<{ confirm: boolean }>((resolve) => {
    uni.showModal({
      title: '',
      content: t('blog.deleteCommentConfirm'),
      success: (res) => resolve({ confirm: res.confirm }),
    })
  })
  if (!confirm) return
  isDeletingComment.value = commentId
  try {
    await apiClient.delete(`/blog/comments/${commentId}`)
    comments.value = comments.value.filter((c) => c.id !== commentId)
    uni.showToast({ title: t('blog.commentDeleted'), icon: 'success' })
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    uni.showToast({
      title: err.response?.data?.error ?? (err as { message?: string }).message ?? t('blog.deleteError'),
      icon: 'none',
    })
  } finally {
    isDeletingComment.value = null
  }
}

async function handleDelete() {
  const { confirm } = await new Promise<{ confirm: boolean }>((resolve) => {
    uni.showModal({
      title: t('blog.deleteConfirm'),
      success: (res) => resolve({ confirm: res.confirm }),
    })
  })
  if (!confirm || !post.value) return
  isDeleting.value = true
  try {
    await apiClient.delete(`/blog/posts/${post.value.id}`)
    uni.showToast({ title: t('blog.deleteSuccess'), icon: 'success' })
    backToList()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    uni.showToast({
      title: err.response?.data?.error ?? (err as { message?: string }).message ?? t('blog.deleteError'),
      icon: 'none',
    })
  } finally {
    isDeleting.value = false
  }
}

function previewImage(url: string) {
  if (!url) return
  uni.previewImage({ urls: [url], current: url })
}

function openYouTube(url: string) {
  if (!url) return
  const videoId = extractYouTubeVideoId(url)
  const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url
  if (typeof window !== 'undefined' && window.open) {
    window.open(watchUrl, '_blank')
  } else {
    uni.setClipboardData({ data: watchUrl })
    uni.showToast({ title: t('common.success'), icon: 'none' })
  }
}

function backToList() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/index/index' }) })
}

function goToEdit() {
  if (!post.value) return
  uni.navigateTo({ url: '/pages/blog-create/blog-create?id=' + encodeURIComponent(post.value.id) })
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/blog-detail/blog-detail?id=' + postId.value) })
}
</script>

<style scoped>
.scroll-area { height: calc(100vh - var(--window-top, 0px) - 88rpx); }
.blog-content {
  font-size: 21px;
  line-height: 1.58;
  color: rgba(0, 0, 0, 0.84);
}
.prose-content :deep(p) {
  margin-bottom: 1.6em;
}
.prose-content :deep(h1) {
  font-size: 42px;
  font-weight: 700;
  margin-top: 1.6em;
  margin-bottom: 0.8em;
}
.prose-content :deep(h2) {
  font-size: 34px;
  font-weight: 700;
  margin-top: 1.6em;
  margin-bottom: 0.8em;
}
.prose-content :deep(img) {
  width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 1em 0;
}
.prose-content :deep(a) {
  color: #ec4899;
  text-decoration: underline;
}
.prose-content :deep(ul),
.prose-content :deep(ol) {
  margin: 1.6em 0;
  padding-left: 2em;
}
.prose-content :deep(blockquote) {
  border-left: 3px solid rgba(0, 0, 0, 0.84);
  padding-left: 1.6em;
  margin: 1.6em 0;
  font-style: italic;
  color: rgba(0, 0, 0, 0.68);
}
.prose-content :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}
.prose-content :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
  padding: 1.6em;
  border-radius: 4px;
  overflow-x: auto;
  margin: 1.6em 0;
}
</style>
