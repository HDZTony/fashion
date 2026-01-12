<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div v-if="isLoading" class="text-center py-12">
      <div class="text-pink-600">{{ $t('blog.loading') }}</div>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <div class="text-red-600">{{ error }}</div>
      <router-link to="/blog" class="mt-4 inline-block text-pink-600 hover:text-pink-700">
        {{ $t('blog.backToList') }}
      </router-link>
    </div>

    <article v-else-if="post" class="bg-white rounded-xl shadow-sm">
      <!-- Header -->
      <div class="p-8 border-b border-pink-200">
        <div class="flex items-start justify-between mb-4">
          <h1 class="text-4xl font-bold text-gray-900 flex-1">
            {{ post.title }}
          </h1>
          <div v-if="isAuthor" class="ml-4 flex gap-2">
            <router-link
              :to="`/blog/${post.id}/edit`"
              class="px-4 py-2 text-sm border border-pink-200 rounded-lg hover:bg-pink-50"
            >
              {{ $t('blog.edit') }}
            </router-link>
            <button
              @click="handleDelete"
              :disabled="isDeleting"
              class="px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {{ isDeleting ? $t('common.loading') : $t('blog.delete') }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>{{ formatDate(post.created_at) }}</span>
          <span v-if="post.status === 'draft'" class="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
            {{ $t('blog.draft') }}
          </span>
          <div v-if="post.tags && post.tags.length > 0" class="flex flex-wrap gap-2">
            <span
              v-for="tag in post.tags"
              :key="tag"
              class="px-2 py-1 rounded-full bg-pink-50 text-pink-600"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <!-- Media Gallery -->
      <div v-if="post.media_urls && post.media_urls.length > 0" class="px-8 pb-8 border-b border-pink-200">
        <h3 class="text-lg font-semibold mb-4">{{ $t('blog.mediaGallery') }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="(media, index) in post.media_urls"
            :key="index"
            class="rounded-lg overflow-hidden border border-pink-200"
          >
            <img
              v-if="media.type === 'image'"
              :src="media.url"
              :alt="`Image ${index + 1}`"
              class="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              @click="openMediaViewer(media.url, index)"
            />
            <video
              v-else
              :src="media.url"
              class="w-full h-auto"
              controls
              preload="metadata"
            />
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="p-8">
        <div
          class="prose prose-pink max-w-none"
          v-html="renderedContent"
        />
      </div>
    </article>

    <!-- Back button -->
    <div class="mt-8">
      <router-link
        to="/blog"
        class="inline-flex items-center gap-2 text-pink-600 hover:text-pink-700"
      >
        <ChevronLeft class="w-4 h-4" />
        {{ $t('blog.backToList') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../lib/api-client'
import { marked } from 'marked'
import { ChevronLeft } from 'lucide-vue-next'

defineOptions({ name: 'BlogDetail' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

interface MediaItem {
  url: string
  type: 'image' | 'video'
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

const post = ref<BlogPost | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const error = ref('')

const isAuthor = computed(() => {
  return authStore.isAuthenticated && post.value && authStore.user && post.value.user_id === authStore.user.id
})

const renderedContent = computed(() => {
  if (!post.value) return ''
  return marked.parse(post.value.content)
})

const loadPost = async () => {
  isLoading.value = true
  error.value = ''

  try {
    const postId = route.params.id as string
    const response = await apiClient.get<BlogPost>(`/blog/posts/${postId}`)
    post.value = response.data
  } catch (e: any) {
    console.error('Failed to load post:', e)
    error.value = e?.response?.data?.error || e?.message || t('blog.loadError')
  } finally {
    isLoading.value = false
  }
}

const handleDelete = async () => {
  if (!post.value || !confirm(t('blog.deleteConfirm'))) {
    return
  }

  isDeleting.value = true

  try {
    await apiClient.delete(`/blog/posts/${post.value.id}`)
    router.push('/blog')
  } catch (e: any) {
    console.error('Failed to delete post:', e)
    alert(e?.response?.data?.error || e?.message || t('blog.deleteError'))
  } finally {
    isDeleting.value = false
  }
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const openMediaViewer = (url: string, index: number) => {
  // Simple image viewer - could be enhanced with a modal
  window.open(url, '_blank')
}

onMounted(() => {
  loadPost()
})
</script>

<style scoped>
:deep(.prose) {
  color: #374151;
}

:deep(.prose h1),
:deep(.prose h2),
:deep(.prose h3) {
  color: #111827;
  font-weight: 700;
  margin-top: 2em;
  margin-bottom: 1em;
}

:deep(.prose p) {
  margin-bottom: 1.25em;
  line-height: 1.75;
}

:deep(.prose code) {
  background-color: #f3f4f6;
  padding: 0.125em 0.375em;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

:deep(.prose pre) {
  background-color: #1f2937;
  color: #f9fafb;
  padding: 1em;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1.5em;
}

:deep(.prose pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

:deep(.prose a) {
  color: #ec4899;
  text-decoration: underline;
}

:deep(.prose a:hover) {
  color: #be185d;
}

:deep(.prose ul),
:deep(.prose ol) {
  margin-bottom: 1.25em;
  padding-left: 1.625em;
}

:deep(.prose li) {
  margin-bottom: 0.5em;
}

:deep(.prose blockquote) {
  border-left: 4px solid #ec4899;
  padding-left: 1em;
  margin-left: 0;
  color: #6b7280;
  font-style: italic;
}
</style>
