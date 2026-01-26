<template>
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
        {{ $t('blog.title') }}
      </h1>
      <router-link
        v-if="authStore.isAuthenticated"
        to="/blog/create"
        class="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-colors"
      >
        {{ $t('blog.create') }}
      </router-link>
    </div>

    <div v-if="isLoading" class="text-center py-12">
      <div class="text-pink-600">{{ $t('blog.loading') }}</div>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <div class="text-red-600">{{ error }}</div>
    </div>

    <div v-else-if="posts.length === 0" class="text-center py-12">
      <div class="text-gray-500">{{ $t('blog.noPosts') }}</div>
    </div>

    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="post in posts"
        :key="post.id"
        class="bg-white border border-pink-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
        @click="goToPost(post.id)"
      >
        <!-- Media Section (Top) -->
        <div class="w-full h-48 bg-gray-100 overflow-hidden relative">
          <template v-if="post.media_urls && post.media_urls.length > 0">
            <img
              v-if="post.media_urls[0].type === 'image'"
              :src="post.media_urls[0].url"
              :alt="post.title"
              class="w-full h-full object-cover"
            />
            <div
              v-else-if="post.media_urls[0].type === 'youtube'"
              class="relative w-full h-full bg-gray-900"
            >
              <img
                :src="post.media_urls[0].thumbnail"
                :alt="post.title"
                class="w-full h-full object-cover opacity-75"
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
            </div>
            <template v-else>
              <!-- Video: Use poster attribute for thumbnail, video will show first frame -->
              <video
                :ref="(el) => setVideoRef(el, post.id)"
                :src="post.media_urls[0].url"
                :poster="post.media_urls[0].thumbnail"
                class="w-full h-full object-cover absolute inset-0"
                preload="metadata"
                muted
                playsinline
                @loadedmetadata="() => handleVideoLoaded(post.id)"
                @error="() => handleVideoError(post.id)"
                @seeked="() => handleVideoSeeked(post.id)"
              />
            </template>
          </template>
          <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
            <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        
        <!-- Title Section (Bottom) -->
        <div class="p-4 flex-1 flex flex-col">
          <h2 class="text-lg font-semibold text-gray-900 line-clamp-2 mb-2">
            {{ post.title }}
          </h2>
          <div v-if="post.tags && post.tags.length > 0" class="mt-auto flex gap-1 flex-wrap">
            <span
              v-for="(tag, index) in post.tags.slice(0, 2)"
              :key="tag"
              class="px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-xs"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <!-- Pagination -->
    <div v-if="posts.length > 0 && hasMore" class="mt-8 text-center">
      <button
        @click="loadMore"
        :disabled="isLoadingMore"
        class="px-6 py-2 border border-pink-200 rounded-lg hover:bg-pink-50 disabled:opacity-50"
      >
        {{ isLoadingMore ? $t('common.loading') : $t('blog.loadMore') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../lib/api-client'

defineOptions({ name: 'BlogList' })

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

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
const videoRefs = ref<Record<string, HTMLVideoElement>>({})

const loadPosts = async (reset = false) => {
  if (reset) {
    offset.value = 0
    posts.value = []
    hasMore.value = true
  }

  if (isLoading.value || isLoadingMore.value) {
    return
  }

  if (reset) {
    isLoading.value = true
  } else {
    isLoadingMore.value = true
  }

  error.value = ''

  try {
    const response = await apiClient.get<{ posts: BlogPost[] }>('/blog/posts', {
      params: {
        limit,
        offset: offset.value,
        status: 'published'
      }
    })

    const newPosts = response.data.posts || []
    
    if (reset) {
      posts.value = newPosts
      videoRefs.value = {}
    } else {
      posts.value.push(...newPosts)
    }

    hasMore.value = newPosts.length === limit
    offset.value += newPosts.length
  } catch (e: any) {
    console.error('Failed to load posts:', e)
    error.value = e?.response?.data?.error || e?.message || t('blog.loadError')
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

const loadMore = () => {
  loadPosts(false)
}

const goToPost = (id: string) => {
  router.push(`/blog/${id}`)
}

const setVideoRef = (el: any, postId: string) => {
  if (el) {
    videoRefs.value[postId] = el as HTMLVideoElement
  }
}

const handleVideoLoaded = (postId: string) => {
  const video = videoRefs.value[postId]
  if (video) {
    // Seek to first frame to show thumbnail
    video.currentTime = 0.1
    video.pause()
  }
}

const handleVideoSeeked = (postId: string) => {
  const video = videoRefs.value[postId]
  if (video) {
    // Ensure video is paused at first frame
    video.pause()
  }
}

const handleVideoError = (postId: string) => {
  console.error(`Failed to load video for post ${postId}`)
}

const getExcerpt = (content: string, maxLength = 150): string => {
  // Remove markdown syntax for excerpt
  const plainText = content.replace(/[#*`\[\]()]/g, '').trim()
  if (plainText.length <= maxLength) {
    return plainText
  }
  return plainText.substring(0, maxLength) + '...'
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

onMounted(() => {
  loadPosts(true)
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
