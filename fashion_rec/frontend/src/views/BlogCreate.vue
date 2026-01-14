<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="flex items-center gap-4 mb-6">
      <button
        @click="router.back()"
        class="flex items-center gap-2 px-4 py-2 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 transition-colors"
      >
        <ArrowLeft class="w-4 h-4" />
        {{ $t('common.back') }}
      </button>
      <h1 class="text-3xl font-bold">
        {{ isEdit ? $t('blog.edit') : $t('blog.create') }}
      </h1>
    </div>
    
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Title -->
      <div>
        <label class="block text-sm font-medium mb-2">{{ $t('blog.titleLabel') }}</label>
        <input
          v-model="form.title"
          type="text"
          required
          class="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          :placeholder="$t('blog.titlePlaceholder')"
        />
      </div>
      
      <!-- Tags -->
      <div>
        <label class="block text-sm font-medium mb-2">{{ $t('blog.tagsLabel') }}</label>
        <input
          v-model="tagsInput"
          type="text"
          class="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          :placeholder="$t('blog.tagsPlaceholder')"
        />
        <p class="mt-1 text-sm text-gray-500">{{ $t('blog.tagsHint') }}</p>
      </div>
      
      <!-- Media Upload -->
      <div>
        <label class="block text-sm font-medium mb-2">{{ $t('blog.mediaLabel') }}</label>
        <div class="space-y-4">
          <!-- Upload Button -->
          <div class="flex gap-2">
            <input
              ref="mediaInputRef"
              type="file"
              accept="image/*,video/*"
              multiple
              @change="handleMediaSelect"
              class="hidden"
            />
            <button
              type="button"
              @click="mediaInputRef?.click()"
              :disabled="isUploading"
              class="px-4 py-2 border border-pink-200 rounded-lg hover:bg-pink-50 disabled:opacity-50 text-sm"
            >
              {{ isUploading ? $t('blog.uploading') : $t('blog.uploadMedia') }}
            </button>
            <span class="text-sm text-gray-500 self-center">
              {{ $t('blog.mediaHint') }}
            </span>
          </div>
          
          <!-- Uploaded Media Preview -->
          <div v-if="form.media_urls && form.media_urls.length > 0" class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              v-for="(media, index) in form.media_urls"
              :key="index"
              class="relative group border border-pink-200 rounded-lg overflow-hidden"
            >
              <img
                v-if="media.type === 'image'"
                :src="media.url"
                :alt="`Image ${index + 1}`"
                class="w-full h-32 object-cover"
              />
              <video
                v-else
                :src="media.url"
                class="w-full h-32 object-cover"
                controls
              />
              <button
                type="button"
                @click="removeMedia(index)"
                class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Content (Markdown) -->
      <div>
        <label class="block text-sm font-medium mb-2">{{ $t('blog.contentLabel') }}</label>
        <textarea
          v-model="form.content"
          required
          rows="20"
          class="w-full px-4 py-2 border border-pink-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono text-sm"
          :placeholder="$t('blog.contentPlaceholder')"
        />
        <p class="mt-1 text-sm text-gray-500">{{ $t('blog.contentHint') }}</p>
      </div>
      
      <!-- Preview (optional) -->
      <div v-if="form.content" class="border border-pink-200 rounded-lg p-4 bg-gray-50">
        <h3 class="text-sm font-medium mb-2">{{ $t('blog.preview') }}</h3>
        <div
          class="prose prose-sm max-w-none"
          v-html="previewContent"
        />
      </div>
      
      <!-- Action buttons -->
      <div class="flex gap-4">
        <button
          type="submit"
          :disabled="isSubmitting"
          class="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 disabled:opacity-50"
        >
          {{ isSubmitting ? $t('common.loading') : (isEdit ? $t('blog.update') : $t('blog.publish')) }}
        </button>
        <router-link
          to="/blog"
          class="px-6 py-2 border border-pink-200 rounded-lg hover:bg-pink-50"
        >
          {{ $t('common.cancel') }}
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiClient } from '../lib/api-client'
import { marked } from 'marked'
import { Upload, X, ArrowLeft } from 'lucide-vue-next'

defineOptions({ name: 'BlogCreate' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)

interface MediaItem {
  url: string
  type: 'image' | 'video'
  thumbnail?: string
}

const form = ref({
  title: '',
  content: '',
  status: 'published' as 'draft' | 'published',
  tags: [] as string[],
  media_urls: [] as MediaItem[]
})

const tagsInput = ref('')
const isSubmitting = ref(false)
const isUploading = ref(false)
const mediaInputRef = ref<HTMLInputElement | null>(null)

const previewContent = computed(() => {
  if (!form.value.content) return ''
  return marked.parse(form.value.content)
})

// Load post (edit mode)
onMounted(async () => {
  if (isEdit.value) {
    try {
      const postId = route.params.id as string
      const response = await apiClient.get(`/blog/posts/${postId}`)
      const post = response.data
      form.value = {
        title: post.title,
        content: post.content,
        status: post.status || 'published',
        tags: post.tags || [],
        media_urls: post.media_urls || []
      }
      tagsInput.value = post.tags?.join(', ') || ''
    } catch (error: any) {
      console.error('Failed to load post:', error)
      alert(error?.response?.data?.error || error?.message || t('blog.loadError'))
      router.push('/blog')
    }
  }
})

const handleMediaSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  isUploading.value = true

  try {
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      
      // Determine media type
      const mediaType = file.type.startsWith('image/') ? 'image' : 'video'
      formData.append('type', mediaType)

      const response = await apiClient.post('/blog/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      const mediaInfo = response.data
      form.value.media_urls.push({
        url: mediaInfo.url,
        type: mediaInfo.type,
        thumbnail: mediaInfo.thumbnail
      })
    }

    // Clear input
    if (mediaInputRef.value) {
      mediaInputRef.value.value = ''
    }
  } catch (error: any) {
    console.error('Failed to upload media:', error)
    alert(error?.response?.data?.error || error?.message || t('blog.uploadError'))
  } finally {
    isUploading.value = false
  }
}

const removeMedia = (index: number) => {
  form.value.media_urls.splice(index, 1)
}

const handleSubmit = async () => {
  isSubmitting.value = true
  
  try {
    // Parse tags
    form.value.tags = tagsInput.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
    
    // Prepare payload (only include media_urls if not empty)
    const payload = {
      ...form.value,
      media_urls: form.value.media_urls.length > 0 ? form.value.media_urls : undefined
    }
    
    if (isEdit.value) {
      // Update post
      await apiClient.put(`/blog/posts/${route.params.id}`, payload)
      alert(t('blog.updateSuccess'))
    } else {
      // Create post
      await apiClient.post('/blog/posts', payload)
      alert(t('blog.createSuccess'))
    }
    
    router.push('/blog')
  } catch (error: any) {
    console.error('Failed to save post:', error)
    alert(error?.response?.data?.error || error?.message || t('blog.saveError'))
  } finally {
    isSubmitting.value = false
  }
}
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
  margin-top: 1em;
  margin-bottom: 0.5em;
}

:deep(.prose p) {
  margin-bottom: 0.75em;
  line-height: 1.6;
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
  padding: 0.75em;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1em;
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
</style>
