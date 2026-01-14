<template>
  <div class="container mx-auto px-4 py-12">
    <div v-if="isLoading" class="text-center py-12">
      <div class="text-pink-600">{{ $t('blog.loading') }}</div>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <div class="text-red-600">{{ error }}</div>
      <router-link to="/blog" class="mt-4 inline-block text-pink-600 hover:text-pink-700">
        {{ $t('blog.backToList') }}
      </router-link>
    </div>

    <article v-else-if="post" class="max-w-[680px] mx-auto">
      <!-- Header -->
      <header class="mb-12">
        <div class="flex items-start justify-between mb-6">
          <h1 class="text-5xl font-bold text-gray-900 leading-tight tracking-tight flex-1">
            {{ post.title }}
          </h1>
          <div v-if="isAuthor" class="ml-6 flex gap-2 flex-shrink-0">
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

        <div v-if="post.tags && post.tags.length > 0" class="flex flex-wrap gap-2">
          <span
            v-for="tag in post.tags"
            :key="tag"
            class="px-3 py-1 text-sm rounded-full bg-pink-50 text-pink-600 font-medium"
          >
            {{ tag }}
          </span>
        </div>
      </header>

      <!-- Media Gallery -->
      <div v-if="post.media_urls && post.media_urls.length > 0" class="mb-12">
        <div class="space-y-6">
          <div
            v-for="(media, index) in post.media_urls"
            :key="index"
            class="rounded-lg overflow-hidden"
          >
            <img
              v-if="media.type === 'image'"
              :src="media.url"
              :alt="`Image ${index + 1}`"
              class="w-full h-auto cursor-pointer hover:opacity-95 transition-opacity"
              @click="openMediaViewer(media.url, index)"
            />
            <video
              v-else
              :src="media.url"
              class="w-full h-auto rounded-lg"
              controls
              preload="metadata"
            />
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="blog-content">
        <div
          class="prose prose-medium"
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
/* Medium-style typography */
.blog-content {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
}

:deep(.prose-medium) {
  color: rgba(0, 0, 0, 0.84);
  font-size: 21px;
  line-height: 1.58;
  letter-spacing: -0.003em;
  max-width: 100%;
}

:deep(.prose-medium p) {
  margin-bottom: 1.6em;
  font-size: 21px;
  line-height: 1.58;
  letter-spacing: -0.003em;
}

:deep(.prose-medium h1) {
  font-size: 42px;
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.015em;
  margin-top: 1.6em;
  margin-bottom: 0.8em;
  color: rgba(0, 0, 0, 0.84);
}

:deep(.prose-medium h2) {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.015em;
  margin-top: 1.6em;
  margin-bottom: 0.8em;
  color: rgba(0, 0, 0, 0.84);
}

:deep(.prose-medium h3) {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.012em;
  margin-top: 1.6em;
  margin-bottom: 0.8em;
  color: rgba(0, 0, 0, 0.84);
}

:deep(.prose-medium h4) {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.22;
  margin-top: 1.6em;
  margin-bottom: 0.8em;
  color: rgba(0, 0, 0, 0.84);
}

:deep(.prose-medium img) {
  width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 2em 0;
}

:deep(.prose-medium a) {
  color: rgba(0, 0, 0, 0.84);
  text-decoration: underline;
  text-decoration-color: rgba(0, 0, 0, 0.3);
  transition: text-decoration-color 0.2s;
}

:deep(.prose-medium a:hover) {
  text-decoration-color: rgba(0, 0, 0, 0.84);
}

:deep(.prose-medium ul),
:deep(.prose-medium ol) {
  margin: 1.6em 0;
  padding-left: 2em;
}

:deep(.prose-medium li) {
  margin-bottom: 0.8em;
  font-size: 21px;
  line-height: 1.58;
}

:deep(.prose-medium blockquote) {
  border-left: 3px solid rgba(0, 0, 0, 0.84);
  padding-left: 1.6em;
  margin: 1.6em 0;
  font-style: italic;
  color: rgba(0, 0, 0, 0.68);
  font-size: 21px;
  line-height: 1.58;
}

:deep(.prose-medium code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

:deep(.prose-medium pre) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1.6em;
  border-radius: 4px;
  overflow-x: auto;
  margin: 1.6em 0;
  font-size: 16px;
  line-height: 1.5;
}

:deep(.prose-medium pre code) {
  background-color: transparent;
  padding: 0;
  font-size: inherit;
}

:deep(.prose-medium hr) {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  margin: 2em 0;
}

:deep(.prose-medium strong) {
  font-weight: 700;
  color: rgba(0, 0, 0, 0.84);
}

:deep(.prose-medium em) {
  font-style: italic;
}
</style>
