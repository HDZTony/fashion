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
              @click="openMediaViewer(media.url)"
            />
            <div
              v-else-if="media.type === 'youtube'"
              class="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden"
            >
              <iframe
                :src="getYouTubeEmbedUrl(media.url)"
                class="w-full h-full"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              />
            </div>
            <video
              v-else
              :src="media.url"
              :poster="media.thumbnail"
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

    <!-- Comments Section -->
    <div class="max-w-[680px] mx-auto mt-16">
      <div class="border-t border-gray-200 pt-12">
        <h2 class="text-2xl font-bold text-gray-900 mb-6">
          {{ $t('blog.comments') }}
          <span v-if="comments.length > 0" class="text-lg font-normal text-gray-500 ml-2">
            ({{ comments.length }})
          </span>
        </h2>

        <!-- Comment Form (only for authenticated users) -->
        <div v-if="authStore.isAuthenticated" class="mb-8">
          <div class="bg-gray-50 rounded-lg p-4 border border-pink-200">
            <textarea
              v-model="newComment"
              :placeholder="$t('blog.commentPlaceholder')"
              rows="4"
              class="w-full px-4 py-3 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
              :disabled="isSubmittingComment"
            />
            <div class="flex justify-end mt-3">
              <button
                @click="submitComment"
                :disabled="!newComment.trim() || isSubmittingComment"
                class="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isSubmittingComment ? $t('common.loading') : $t('blog.submitComment') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Login prompt for unauthenticated users -->
        <div v-else class="mb-8 bg-pink-50 border border-pink-200 rounded-lg p-4 text-center">
          <p class="text-gray-700">{{ $t('blog.loginToComment') }}</p>
          <router-link
            to="/login"
            class="mt-2 inline-block text-pink-600 hover:text-pink-700 font-medium"
          >
            {{ $t('nav.login') }}
          </router-link>
        </div>

        <!-- Comments List -->
        <div v-if="isLoadingComments" class="text-center py-8">
          <div class="text-pink-600">{{ $t('common.loading') }}</div>
        </div>

        <div v-else-if="comments.length === 0" class="text-center py-12 text-gray-500">
          {{ $t('blog.noComments') }}
        </div>

        <div v-else class="space-y-6">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="bg-white border border-pink-200 rounded-lg p-4"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                  {{ getUserInitial(comment.user_id) }}
                </div>
                <div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ getUserDisplayName(comment.user_id) }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ formatDate(comment.created_at) }}
                  </div>
                </div>
              </div>
              <button
                v-if="canDeleteComment(comment)"
                @click="deleteComment(comment.id)"
                :disabled="isDeletingComment === comment.id"
                class="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
              >
                {{ isDeletingComment === comment.id ? $t('common.loading') : $t('blog.deleteComment') }}
              </button>
            </div>
            <div class="text-gray-700 whitespace-pre-wrap">{{ comment.content }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Back button -->
    <div class="mt-8 max-w-[680px] mx-auto">
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@vueuse/head'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../lib/api-client'
import { marked } from 'marked'
import { ChevronLeft } from 'lucide-vue-next'
import { siteBaseUrl } from '../config/seo'
import { useSEO } from '../composables/useSEO'
import { extractYouTubeVideoId, getYouTubeEmbedUrl as getYouTubeEmbedUrlUtil } from '../utils/youtube'

defineOptions({ name: 'BlogDetail' })

const { t } = useI18n()
const route = useRoute()
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

interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

const post = ref<BlogPost | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const error = ref('')
const comments = ref<Comment[]>([])
const isLoadingComments = ref(false)
const newComment = ref('')
const isSubmittingComment = ref(false)
const isDeletingComment = ref<string | null>(null)

const isAuthor = computed(() => {
  return authStore.isAuthenticated && post.value && authStore.user && post.value.user_id === authStore.user.id
})

const renderedContent = computed(() => {
  if (!post.value) return ''
  return marked.parse(post.value.content)
})

// Extract plain text from markdown for description
const extractPlainText = (html: string): string => {
  if (typeof window === 'undefined') {
    // SSR: Simple regex-based extraction
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }
  // Client-side: Use DOM parsing
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

const postDescription = computed(() => {
  if (!post.value) return ''
  const content = renderedContent.value
  if (typeof content !== 'string') return ''
  const plainText = extractPlainText(content)
  // Get first 200 characters for description
  return plainText.substring(0, 200).trim()
})

const postUrl = computed(() => {
  if (!post.value) return ''
  return `${siteBaseUrl}/blog/${post.value.id}`
})

// Generate BlogPosting structured data
const blogPostingSchema = computed(() => {
  if (!post.value) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.value.title,
    description: postDescription.value,
    datePublished: post.value.created_at,
    dateModified: post.value.updated_at,
    url: postUrl.value,
    author: {
      '@type': 'Person',
      name: 'Fashion Rec Author',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Fashion Rec',
      logo: {
        '@type': 'ImageObject',
        url: `${siteBaseUrl}/images/brand/hdz.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl.value,
    },
    image: post.value.media_urls?.filter((m) => m.type === 'image').map((m) => m.url) || [],
    keywords: post.value.tags?.join(', ') || '',
    articleSection: 'Fashion',
    wordCount: post.value.content?.split(' ').length || 0,
    timeRequired: 'PT5M', // Estimated reading time
  }
})

// Generate Article structured data (alternative/complementary to BlogPosting)
const articleSchema = computed(() => {
  if (!post.value) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.value.title,
    description: postDescription.value,
    datePublished: post.value.created_at,
    dateModified: post.value.updated_at,
    url: postUrl.value,
    author: {
      '@type': 'Person',
      name: 'Fashion Rec Author',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Fashion Rec',
      logo: {
        '@type': 'ImageObject',
        url: `${siteBaseUrl}/images/brand/hdz.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl.value,
    },
    image: post.value.media_urls?.filter((m) => m.type === 'image').map((m) => m.url) || [],
    keywords: post.value.tags?.join(', ') || '',
    articleSection: 'Fashion',
    wordCount: post.value.content?.split(' ').length || 0,
    timeRequired: 'PT5M',
    // Add breadcrumb structured data
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: siteBaseUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: `${siteBaseUrl}/blog`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: post.value.title,
          item: postUrl.value,
        },
      ],
    },
  }
})

// Generate VideoObject structured data for each video
const videoSchemas = computed(() => {
  if (!post.value || !post.value.media_urls) return []

  const videos = post.value.media_urls.filter((m) => m.type === 'video')
  if (videos.length === 0) return []

  // Find first image as thumbnail fallback
  const firstImage = post.value.media_urls.find((m) => m.type === 'image')

  return videos.map((video, index) => {
    const schema: any = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: `${post.value!.title}${videos.length > 1 ? ` - Video ${index + 1}` : ''}`,
      description: postDescription.value || post.value!.title,
      contentUrl: video.url,
      embedUrl: `${postUrl.value}#video-${index}`, // Link to video section on page
      uploadDate: post.value!.created_at,
      datePublished: post.value!.created_at,
      dateModified: post.value!.updated_at,
      thumbnailUrl: video.thumbnail || firstImage?.url || `${siteBaseUrl}/images/brand/hdz.png`,
      // Default duration - in production, this should be extracted from video metadata
      duration: 'PT5M0S', // ISO 8601 duration format (5 minutes)
      // Add video quality information
      videoQuality: 'HD',
      // Add interaction statistics (can be populated from analytics)
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/WatchAction',
        userInteractionCount: 0 // Can be updated with actual view counts
      },
      // Add author information
      author: {
        '@type': 'Person',
        name: 'Fashion Rec Author',
      },
      // Add publisher information
      publisher: {
        '@type': 'Organization',
        name: 'Fashion Rec',
        logo: {
          '@type': 'ImageObject',
          url: `${siteBaseUrl}/images/brand/hdz.png`,
        },
      },
      // Add mainEntityOfPage
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': postUrl.value,
      },
      // Add keywords/tags
      keywords: post.value!.tags?.join(', ') || '',
    }

    return schema
  })
})

// Combine all structured data
const structuredDataScripts = computed(() => {
  const scripts: Array<{ type: string; children: string }> = []

  if (blogPostingSchema.value) {
    scripts.push({
      type: 'application/ld+json',
      children: JSON.stringify(blogPostingSchema.value),
    })
  }

  if (articleSchema.value) {
    scripts.push({
      type: 'application/ld+json',
      children: JSON.stringify(articleSchema.value),
    })
  }

  videoSchemas.value.forEach((videoSchema) => {
    scripts.push({
      type: 'application/ld+json',
      children: JSON.stringify(videoSchema),
    })
  })

  return scripts
})

// Set up SEO and structured data
watch(
  () => post.value,
  (newPost) => {
    if (!newPost) return

    useSEO({
      title: `${newPost.title} | Fashion Rec Blog`,
      description: postDescription.value || 'Read more on Fashion Rec Blog',
      path: `/blog/${newPost.id}`,
      image: newPost.media_urls?.find((m) => m.type === 'image')?.url || `${siteBaseUrl}/images/brand/hdz.png`,
    })

    useHead({
      script: structuredDataScripts.value.map((script) => ({
        type: script.type,
        children: script.children,
      })),
    })
  },
  { immediate: true }
)

const loadPost = async () => {
  isLoading.value = true
  error.value = ''

  try {
    const postId = route.params.id as string
    const response = await apiClient.get<BlogPost>(`/blog/posts/${postId}`)
    post.value = response.data
    // Load comments after post is loaded
    if (post.value && post.value.status === 'published') {
      loadComments()
    }
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

const getYouTubeEmbedUrl = (url: string): string => {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    return ''
  }
  return getYouTubeEmbedUrlUtil(videoId, { rel: false, modestbranding: true })
}

const loadComments = async () => {
  if (!post.value) return

  isLoadingComments.value = true
  try {
    const response = await apiClient.get<{ comments: Comment[] }>(`/blog/posts/${post.value.id}/comments`)
    comments.value = response.data.comments || []
  } catch (e: any) {
    console.error('Failed to load comments:', e)
  } finally {
    isLoadingComments.value = false
  }
}

const submitComment = async () => {
  if (!post.value || !newComment.value.trim()) return

  isSubmittingComment.value = true
  try {
    const response = await apiClient.post<Comment>(`/blog/posts/${post.value.id}/comments`, {
      content: newComment.value.trim()
    })
    // Add new comment to the beginning of the list
    comments.value.unshift(response.data)
    newComment.value = ''
  } catch (e: any) {
    console.error('Failed to submit comment:', e)
    alert(e?.response?.data?.error || e?.message || t('blog.commentError'))
  } finally {
    isSubmittingComment.value = false
  }
}

const deleteComment = async (commentId: string) => {
  if (!confirm(t('blog.deleteCommentConfirm'))) return

  isDeletingComment.value = commentId
  try {
    await apiClient.delete(`/blog/comments/${commentId}`)
    comments.value = comments.value.filter(c => c.id !== commentId)
    alert(t('blog.commentDeleted'))
  } catch (e: any) {
    console.error('Failed to delete comment:', e)
    alert(e?.response?.data?.error || e?.message || t('blog.deleteError'))
  } finally {
    isDeletingComment.value = null
  }
}

const canDeleteComment = (comment: Comment): boolean => {
  if (!authStore.isAuthenticated || !authStore.user) return false
  // Comment author can delete
  if (comment.user_id === authStore.user.id) return true
  // Post author can delete any comment
  if (post.value && post.value.user_id === authStore.user.id) return true
  return false
}

const getUserDisplayName = (userId: string): string => {
  // If it's the current user, show "You"
  if (authStore.isAuthenticated && authStore.user && userId === authStore.user.id) {
    return t('blog.you')
  }
  // Otherwise show a generic name or user ID
  return `User ${userId.substring(0, 8)}`
}

const getUserInitial = (userId: string): string => {
  // Use first character of user ID as initial
  return userId.substring(0, 1).toUpperCase()
}

const openMediaViewer = (url: string) => {
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
