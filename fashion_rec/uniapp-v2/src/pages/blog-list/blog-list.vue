<template>
  <view class="page">
    <wd-navbar
      :title="t('blog.title')"
      fixed
      placeholder
      safe-area-inset-top
      bordered
      :right-text="hasToken ? t('blog.create') : ''"
      @click-right="goToCreate"
    />
    <z-paging
      ref="pagingRef"
      v-model="posts"
      :fixed="false"
      :auto="true"
      :default-page-size="pageSize"
      :safe-area-inset-bottom="true"
      :style="{ height: listHeight }"
      @query="queryList"
    >
      <view class="grid">
        <view
          v-for="post in posts"
          :key="post.id"
          class="card"
          @click="goToPost(post.id)"
        >
          <view class="card-media">
            <image
              v-if="getFirstMediaUrl(post).url"
              :src="getFirstMediaUrl(post).url"
              class="card-img"
              mode="aspectFill"
            />
            <view v-else-if="getFirstMediaUrl(post).isYoutube" class="card-media youtube-wrap">
              <image
                v-if="getFirstMediaUrl(post).thumb"
                :src="getFirstMediaUrl(post).thumb"
                class="card-img"
                mode="aspectFill"
              />
              <view class="play-overlay"><text class="play-icon">▶</text></view>
            </view>
            <view v-else class="card-media-placeholder">
              <text class="placeholder-icon">📄</text>
            </view>
          </view>
          <view class="card-body">
            <text class="card-title">{{ post.title }}</text>
            <view v-if="post.tags?.length" class="card-tags">
              <text v-for="tag in post.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</text>
            </view>
          </view>
        </view>
      </view>
    </z-paging>
    <CustomTabBar current-tab="blog" />
  </view>
</template>

<script setup lang="ts">
definePage({
  style: {
    navigationStyle: 'custom',
  },
})
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import CustomTabBar from '@/components/CustomTabBar.vue'
import { apiClient } from '@/lib/api-client'

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
const hasToken = ref(false)
const pagingRef = ref<any>(null)
const pageSize = 20

// 计算列表可用高度：窗口高度 - navbar - tabbar - safeBottom
const sysInfo = uni.getSystemInfoSync()
const listHeight = computed(() => {
  const winH = sysInfo.windowHeight ?? sysInfo.screenHeight ?? 0
  const statusBarH = sysInfo.statusBarHeight ?? 0
  const navbarH = 44 + statusBarH
  const tabBarH = 50
  const safeBottom = (sysInfo as { safeAreaInsets?: { bottom?: number } }).safeAreaInsets?.bottom ?? 0
  const h = winH - navbarH - tabBarH - safeBottom
  return `${Math.max(200, h)}px`
})

function getFirstMediaUrl(post: BlogPost): { url: string; thumb?: string; isYoutube?: boolean } {
  const media = post.media_urls?.[0]
  if (!media) return { url: '' }
  if (media.type === 'image') return { url: media.url }
  if (media.type === 'youtube') return { url: '', thumb: media.thumbnail, isYoutube: true }
  return { url: media.thumbnail ?? media.url }
}

/**
 * z-paging 查询回调
 * @param pageNo 当前页码（从 1 开始）
 * @param pageSize 每页数量
 */
async function queryList(pageNo: number, pageSize: number) {
  try {
    const offset = (pageNo - 1) * pageSize
    const response = await apiClient.get<{ posts: BlogPost[] }>('/blog/posts', {
      params: {
        limit: String(pageSize),
        offset: String(offset),
        status: 'published',
      },
      timeout: 30000,
    })
    const newPosts = response.data?.posts ?? []
    pagingRef.value?.complete(newPosts)
  } catch (e: unknown) {
    pagingRef.value?.complete(false)
    const err = e as { message?: string }
    uni.showToast({ title: err.message ?? t('blog.loadError'), icon: 'none' })
  }
}

function goToPost(id: string) {
  uni.navigateTo({ url: '/pages/blog-detail/blog-detail?id=' + encodeURIComponent(id) })
}

function goToCreate() {
  if (!hasToken.value) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/blog-create/blog-create') })
    return
  }
  uni.navigateTo({ url: '/pages/blog-create/blog-create' })
}

onShow(() => {
  hasToken.value = !!uni.getStorageSync('auth_token')
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fdf2f8 0%, #fff 30%, #faf5ff 100%);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  padding: 24rpx;
}
.card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  border: 1rpx solid rgba(236, 72, 153, 0.2);
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.card-media {
  width: 100%;
  height: 280rpx;
  background: #f3f4f6;
  position: relative;
}
.card-img {
  width: 100%;
  height: 100%;
}
.card-media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.youtube-wrap {
  position: relative;
}
.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}
.play-icon {
  font-size: 64rpx;
  color: #fff;
}
.placeholder-icon {
  font-size: 64rpx;
}
.card-body {
  padding: 20rpx;
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.tag {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(236, 72, 153, 0.1);
  color: #be185d;
  font-size: 22rpx;
}
</style>
