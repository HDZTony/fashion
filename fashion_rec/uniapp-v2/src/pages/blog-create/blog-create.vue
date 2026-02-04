<template>
  <view class="page">
    <wd-navbar
      :title="isEdit ? t('blog.edit') : t('blog.create')"
      :left-text="t('common.back')"
      left-arrow
      fixed
      placeholder
      safe-area-inset-top
      bordered
      @click-left="goBack"
    />
    <scroll-view scroll-y class="form-wrap">
      <view class="form">
        <view class="field">
          <text class="label">{{ t('blog.titleLabel') }}</text>
          <input
            v-model="form.title"
            class="input"
            type="text"
            :placeholder="t('blog.titlePlaceholder')"
          />
        </view>
        <view class="field">
          <text class="label">{{ t('blog.tagsLabel') }}</text>
          <input
            v-model="tagsInput"
            class="input"
            type="text"
            :placeholder="t('blog.tagsPlaceholder')"
          />
          <text class="hint">{{ t('blog.tagsHint') }}</text>
        </view>
        <view class="field">
          <text class="label">{{ t('blog.mediaLabel') }}</text>
          <view class="media-actions">
            <button type="button" class="btnUpload" :disabled="isUploading" @click="chooseMedia">
              {{ isUploading ? t('blog.uploading') : t('blog.uploadMedia') }}
            </button>
            <text class="hint-inline">{{ t('blog.mediaHint') }}</text>
          </view>
          <view class="youtube-row">
            <input
              v-model="youtubeUrlInput"
              class="input youtube-input"
              type="text"
              :placeholder="t('blog.youtubeUrlPlaceholder')"
              @confirm="handleYouTubeUrl"
            />
            <button type="button" class="btnYoutube" :disabled="!youtubeUrlInput.trim()" @click="handleYouTubeUrl">
              {{ t('blog.addYouTube') }}
            </button>
          </view>
          <view v-if="form.media_urls.length" class="media-preview">
            <view v-for="(media, idx) in form.media_urls" :key="idx" class="media-item">
              <image v-if="media.type === 'image'" :src="media.url" class="media-thumb" mode="aspectFill" />
              <view v-else-if="media.type === 'youtube'" class="media-thumb youtube-thumb">
                <image v-if="media.thumbnail" :src="media.thumbnail" class="thumb-img" mode="aspectFill" />
                <text class="play-icon">▶</text>
              </view>
              <video v-else :src="media.url" class="media-thumb" controls />
              <button type="button" class="btnDelMedia" @click="removeMedia(idx)">×</button>
            </view>
          </view>
        </view>
        <view class="field">
          <text class="label">{{ t('blog.contentLabel') }}</text>
          <textarea
            v-model="form.content"
            class="textarea"
            :placeholder="t('blog.contentPlaceholder')"
            :maxlength="-1"
          />
          <text class="hint">{{ t('blog.contentHint') }}</text>
        </view>
        <view v-if="form.content" class="preview-field">
          <text class="label">{{ t('blog.preview') }}</text>
          <rich-text class="preview-content" :nodes="previewContent" />
        </view>
        <view class="actions">
          <button class="btnSubmit" :disabled="isSubmitting" @click="handleSubmit">
            {{ isSubmitting ? t('common.loading') : (isEdit ? t('blog.update') : t('blog.publish')) }}
          </button>
          <button class="btnCancel" @click="goBack">{{ t('common.cancel') }}</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiClient } from '@/lib/api-client'
import { marked } from 'marked'
import { extractYouTubeVideoId, isYouTubeUrl, getYouTubeThumbnail } from '@/lib/youtube'
import { API_URL } from '@/config/api'

const { t } = useI18n()

interface MediaItem {
  url: string
  type: 'image' | 'video' | 'youtube'
  thumbnail?: string
}

const form = ref({
  title: '',
  content: '',
  status: 'published' as 'draft' | 'published',
  tags: [] as string[],
  media_urls: [] as MediaItem[],
})

const tagsInput = ref('')
const isSubmitting = ref(false)
const isUploading = ref(false)
const youtubeUrlInput = ref('')
const postId = ref('')
const isEdit = computed(() => !!postId.value)

const previewContent = computed(() => {
  if (!form.value.content) return ''
  try {
    return marked.parse(form.value.content) as string
  } catch {
    return form.value.content
  }
})

function getToken(): string {
  return uni.getStorageSync('auth_token') ?? ''
}

async function uploadFile(tempFilePath: string, mediaType: 'image' | 'video'): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: API_URL + '/blog/media/upload',
      filePath: tempFilePath,
      name: 'file',
      formData: { type: mediaType },
      header: { Authorization: 'Bearer ' + getToken() },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data)
            resolve({
              url: data.url,
              type: data.type ?? mediaType,
              thumbnail: data.thumbnail,
            })
          } catch {
            reject(new Error('Invalid response'))
          }
        } else {
          reject(new Error(res.data || 'Upload failed'))
        }
      },
      fail: (err) => reject(err),
    })
  })
}

async function chooseMedia() {
  isUploading.value = true
  try {
    const res = await new Promise<UniApp.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
      uni.chooseMedia({
        count: 9 - form.value.media_urls.length,
        mediaType: ['image', 'video'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject,
      })
    })
    for (const file of res.tempFiles || []) {
      const type = (file.fileType?.startsWith('image') ? 'image' : 'video') as 'image' | 'video'
      const item = await uploadFile(file.tempFilePath, type)
      form.value.media_urls.push(item)
    }
  } catch (e) {
    uni.showToast({ title: (e as Error).message || t('blog.uploadError'), icon: 'none' })
  } finally {
    isUploading.value = false
  }
}

function removeMedia(idx: number) {
  form.value.media_urls.splice(idx, 1)
}

function handleYouTubeUrl() {
  const url = youtubeUrlInput.value.trim()
  if (!url) return
  if (!isYouTubeUrl(url)) {
    uni.showToast({ title: t('blog.invalidYouTubeUrl'), icon: 'none' })
    return
  }
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    uni.showToast({ title: t('blog.invalidYouTubeUrl'), icon: 'none' })
    return
  }
  const thumbnail = getYouTubeThumbnail(videoId)
  form.value.media_urls.push({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    type: 'youtube',
    thumbnail,
  })
  youtubeUrlInput.value = ''
}

async function handleSubmit() {
  if (!form.value.title.trim()) {
    uni.showToast({ title: t('blog.titlePlaceholder'), icon: 'none' })
    return
  }
  isSubmitting.value = true
  try {
    form.value.tags = tagsInput.value.split(',').map((s) => s.trim()).filter(Boolean)
    const payload = {
      ...form.value,
      media_urls: form.value.media_urls.length > 0 ? form.value.media_urls : undefined,
    }
    if (isEdit.value) {
      await apiClient.put(`/blog/posts/${postId.value}`, payload)
      uni.showToast({ title: t('blog.updateSuccess'), icon: 'success' })
    } else {
      await apiClient.post('/blog/posts', payload)
      uni.showToast({ title: t('blog.createSuccess'), icon: 'success' })
    }
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/blog-list/blog-list' }) })
    }, 800)
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    uni.showToast({ title: err.response?.data?.error ?? err.message ?? t('blog.saveError'), icon: 'none' })
  } finally {
    isSubmitting.value = false
  }
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/blog-list/blog-list' }) })
}

onLoad((options?: Record<string, string | undefined>) => {
  postId.value = options?.id ?? ''
  if (postId.value) {
    apiClient.get(`/blog/posts/${postId.value}`).then((res) => {
      const post = (res as { data?: Record<string, unknown> }).data
      if (!post) return
      form.value = {
        title: (post.title as string) ?? '',
        content: (post.content as string) ?? '',
        status: ((post.status as string) || 'published') as 'draft' | 'published',
        tags: (post.tags as string[]) ?? [],
        media_urls: (post.media_urls as MediaItem[]) ?? [],
      }
      tagsInput.value = (form.value.tags || []).join(', ')
    }).catch(() => {
      uni.showToast({ title: t('blog.loadError'), icon: 'none' })
      goBack()
    })
  }
})
</script>

<style scoped>
.page { min-height: 100vh; background: #fff; padding: 24rpx; }
.form-wrap { height: calc(100vh - var(--window-top, 0px) - 120rpx); }
.form { padding-bottom: 48rpx; }
.field { margin-bottom: 32rpx; }
.label { font-size: 28rpx; font-weight: 500; color: #374151; display: block; margin-bottom: 12rpx; }
.input { width: 100%; padding: 24rpx; border: 1rpx solid rgba(236, 72, 153, 0.3); border-radius: 16rpx; font-size: 28rpx; box-sizing: border-box; }
.textarea { width: 100%; min-height: 320rpx; padding: 24rpx; border: 1rpx solid rgba(236, 72, 153, 0.3); border-radius: 16rpx; font-size: 28rpx; box-sizing: border-box; }
.hint, .hint-inline { font-size: 24rpx; color: #9ca3af; display: block; margin-top: 8rpx; }
.hint-inline { display: inline; margin-left: 16rpx; }
.media-actions { display: flex; align-items: center; flex-wrap: wrap; margin-bottom: 16rpx; }
.btnUpload { padding: 16rpx 32rpx; border: 1rpx solid rgba(236, 72, 153, 0.3); color: #ec4899; border-radius: 16rpx; font-size: 28rpx; }
.youtube-row { display: flex; gap: 16rpx; margin-top: 16rpx; }
.youtube-input { flex: 1; min-width: 0; }
.btnYoutube { padding: 16rpx 32rpx; background: #dc2626; color: #fff; border-radius: 16rpx; font-size: 28rpx; flex-shrink: 0; }
.media-preview { display: flex; flex-wrap: wrap; gap: 24rpx; margin-top: 24rpx; }
.media-item { position: relative; width: 200rpx; height: 200rpx; border-radius: 16rpx; overflow: hidden; border: 1rpx solid #e5e7eb; }
.media-thumb { width: 100%; height: 100%; }
.youtube-thumb { position: relative; background: #111; display: flex; align-items: center; justify-content: center; }
.thumb-img { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.75; }
.play-icon { font-size: 48rpx; color: #fff; z-index: 1; }
.btnDelMedia { position: absolute; top: 8rpx; right: 8rpx; width: 48rpx; height: 48rpx; padding: 0; background: #ef4444; color: #fff; border-radius: 50%; font-size: 32rpx; line-height: 48rpx; text-align: center; }
.preview-field { margin-top: 32rpx; padding: 24rpx; background: #f9fafb; border-radius: 16rpx; border: 1rpx solid #e5e7eb; }
.preview-content { font-size: 26rpx; color: #374151; line-height: 1.6; }
.actions { display: flex; gap: 24rpx; margin-top: 48rpx; }
.btnSubmit { flex: 1; padding: 24rpx; background: linear-gradient(90deg, #ec4899, #a855f7); color: #fff; border-radius: 16rpx; font-size: 30rpx; }
.btnCancel { padding: 24rpx 32rpx; border: 1rpx solid rgba(236, 72, 153, 0.3); color: #ec4899; border-radius: 16rpx; font-size: 30rpx; }
</style>
