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
        class="bg-white border border-pink-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        @click="goToPost(post.id)"
      >
        <div class="p-6">
          <div class="flex items-start justify-between mb-3">
            <h2 class="text-xl font-semibold text-gray-900 line-clamp-2">
              {{ post.title }}
            </h2>
            <span
              v-if="post.status === 'draft'"
              class="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600"
            >
              {{ $t('blog.draft') }}
            </span>
          </div>
          
          <p class="text-gray-600 text-sm mb-4 line-clamp-3">
            {{ getExcerpt(post.content) }}
          </p>
          
          <div class="flex flex-wrap gap-2 mb-4">
            <span
              v-for="tag in post.tags"
              :key="tag"
              class="px-2 py-1 text-xs rounded-full bg-pink-50 text-pink-600"
            >
              {{ tag }}
            </span>
          </div>
          
          <div class="text-xs text-gray-500">
            {{ formatDate(post.created_at) }}
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

interface BlogPost {
  id: string
  title: string
  content: string
  tags: string[]
  status: 'draft' | 'published'
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
