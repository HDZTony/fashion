<template>
  <view class="page">
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
    <!-- 未登录提示 -->
    <view v-if="!currentUserId" class="text-center py-20">
      <text class="text-sm text-gray-500 block mb-4">Please sign in to view your blog posts</text>
    </view>
    <z-paging
      v-else
      ref="pagingRef"
      v-model="posts"
      :fixed="false"
      :auto="true"
      :default-page-size="pageSize"
      @query="queryList"
    >
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
    </z-paging>
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
const pagingRef = ref<any>(null)
const pageSize = 20
const currentUserId = ref<string | null>(null)

function getFirstMediaUrl(post: BlogPost): string {
  const media = post.media_urls?.[0]
  if (!media) return ''
  if (media.type === 'image') return media.url
  return media.thumbnail ?? media.url
}

async function queryList(pageNo: number, pageSize: number) {
  if (!currentUserId.value) {
    pagingRef.value?.complete([])
    return
  }
  try {
    const offset = (pageNo - 1) * pageSize
    const response = await apiClient.get<{ posts: BlogPost[] }>('/blog/posts', {
      params: {
        limit: String(pageSize),
        offset: String(offset),
        user_id: currentUserId.value,
      },
      timeout: 30000,
    })
    const newPosts = response.data?.posts ?? []
    pagingRef.value?.complete(newPosts)
  } catch {
    pagingRef.value?.complete(false)
  }
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
    // 从列表中移除并刷新
    posts.value = posts.value.filter((p) => p.id !== id)
    uni.showToast({ title: t('blog.deleteSuccess'), icon: 'success' })
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    uni.showToast({ title: err.response?.data?.error ?? err.message ?? t('blog.deleteError'), icon: 'none' })
  }
}

function initUser() {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      currentUserId.value = user.id
      pagingRef.value?.reload()
    }
  })
}

onShow(() => {
  if (props.embedded) return
  const token = uni.getStorageSync('auth_token')
  if (!token) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/my-blog/my-blog') })
    return
  }
  initUser()
})

onMounted(() => {
  if (props.embedded) initUser()
})
</script>

<style scoped>
.page { padding: 24rpx; min-height: 100%; background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%); }
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
</style>
