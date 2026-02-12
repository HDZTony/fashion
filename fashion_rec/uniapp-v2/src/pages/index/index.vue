<template>
  <view class="flex h-screen bg-gray-100" :style="{ height: pageHeightStyle }">
    <!-- 侧边栏：对齐前端 Sidebar + SidebarNavUser -->
    <view class="sidebar-wrap" :class="{ 'sidebar-hidden': isMobile && !sidebarVisible }">
      <view class="flex flex-col h-full px-[10px]">
        <view class="p-4 border-b border-pink-100 flex items-center justify-center gap-2">
          <text class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Fashion Rec</text>
          <text class="px-2 py-0.5 text-xs font-semibold rounded-full bg-pink-100 text-pink-700 border border-pink-200">V2</text>
        </view>
        <scroll-view scroll-y class="flex-1 min-h-0 !px-0">
          <view class="text-xs text-gray-400 py-2 px-3 pt-4">{{ t('nav.sidebarGroupMain') }}</view>
          <!-- 工作室：可折叠 -->
          <view class="nav-group">
            <view
              class="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1 min-h-10"
              :class="isStudioActive ? 'bg-pink-100/50 text-pink-700' : ''"
              @click="studioOpen = !studioOpen"
            >
              <wd-icon name="chart" size="32rpx" color="#6b7280" />
              <text class="flex-1 text-sm font-medium">{{ t('nav.studio') }}</text>
              <wd-icon :name="studioOpen ? 'chevron-down' : 'chevron-right'" size="28rpx" color="#9ca3af" class="shrink-0" />
            </view>
            <view v-show="studioOpen" class="mb-1 pl-4">
              <view
                v-for="(item, idx) in studioSubItems"
                :key="'studio-' + idx"
                :class="['flex items-center rounded-lg px-3 py-2 min-h-8 mb-1', activeIndex === item.value ? 'bg-pink-100/50 text-pink-700' : '']"
                @click="onNavClick(item)"
              >
                <text class="flex-1 text-sm">{{ t(item.labelKey) }}</text>
              </view>
            </view>
          </view>
          <!-- 我的衣橱 -->
          <view
            :class="['flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1 min-h-10', activeIndex === 2 ? 'bg-pink-100/50 text-pink-700' : '']"
            @click="onNavClick({ value: 2, labelKey: 'nav.wardrobe', tab: 'wardrobe' })"
          >
            <wd-icon name="bags" size="32rpx" color="#6b7280" />
            <text class="flex-1 text-sm font-medium">{{ t('nav.wardrobe') }}</text>
          </view>

          <view class="text-xs text-gray-400 py-2 px-3 pt-4 mt-auto">{{ t('nav.sidebarGroupHistory') }}</view>
          <!-- 历史：可折叠 -->
          <view>
            <view
              :class="['flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1 min-h-10', isHistoryActive ? 'bg-pink-100/50 text-pink-700' : '']"
              @click="historyOpen = !historyOpen"
            >
              <wd-icon name="history" size="32rpx" color="#6b7280" />
              <text class="flex-1 text-sm font-medium">{{ t('nav.history') }}</text>
              <wd-icon :name="historyOpen ? 'chevron-down' : 'chevron-right'" size="28rpx" color="#9ca3af" class="shrink-0" />
            </view>
            <view v-show="historyOpen" class="mb-1 pl-4">
              <view
                v-for="(item, idx) in historySubItems"
                :key="'hist-' + idx"
                :class="['flex items-center rounded-lg px-3 py-2 min-h-8 mb-1', activeIndex === item.value ? 'bg-pink-100/50 text-pink-700' : '']"
                @click="onNavClick(item)"
              >
                <text class="flex-1 text-sm">{{ t(item.labelKey) }}</text>
              </view>
            </view>
          </view>
          <view
            :class="['flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1 min-h-10', activeIndex === 5 ? 'bg-pink-100/50 text-pink-700' : '']"
            @click="onNavClick({ value: 5, labelKey: 'nav.favorites', tab: 'favorites' })"
          >
            <wd-icon name="heart" size="32rpx" color="#6b7280" />
            <text class="flex-1 text-sm font-medium">{{ t('nav.favorites') }}</text>
          </view>
          <view
            :class="['flex items-center gap-2 rounded-lg px-3 py-2.5 mb-1 min-h-10', activeIndex === 6 ? 'bg-pink-100/50 text-pink-700' : '']"
            @click="onNavClick({ value: 6, labelKey: 'nav.myBlog', tab: 'blog' })"
          >
            <wd-icon name="file" size="32rpx" color="#6b7280" />
            <text class="flex-1 text-sm font-medium">{{ t('nav.myBlog') }}</text>
          </view>

          <view class="text-xs text-gray-400 py-2 px-3 pt-4">{{ t('nav.contact') }}</view>
          <view class="flex items-center gap-2 rounded-lg px-3 py-2 min-h-8 mb-1" @click="onContact">
            <wd-icon name="mail" size="32rpx" color="#6b7280" />
            <text class="flex-1 text-sm">{{ t('nav.contact') }}</text>
          </view>
        </scroll-view>
        <!-- 底部用户区：未登录显示「登录」，已登录显示头像+名称 -->
        <view class="border-t border-pink-100 py-3 shrink-0">
          <view
            class="flex items-center gap-2 rounded-lg px-3 py-3 min-h-12 w-full"
            @click="onUserAreaClick"
          >
            <template v-if="user">
              <view class="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-pink-100 flex items-center justify-center">
                <image
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  class="w-full h-full"
                  mode="aspectFill"
                />
                <text v-else class="text-pink-700 text-xs font-semibold">{{ fallbackInitials }}</text>
              </view>
              <view class="flex-1 min-w-0 grid text-left">
                <text class="text-sm font-medium truncate block">{{ displayName || '—' }}</text>
                <text class="text-xs text-gray-500 truncate block">{{ displayEmail || '—' }}</text>
              </view>
              <wd-icon name="chevron-down" size="28rpx" color="#9ca3af" class="shrink-0" />
            </template>
            <template v-else>
              <view class="w-8 h-8 rounded-lg shrink-0 bg-pink-100 flex items-center justify-center">
                <text class="text-pink-600 text-lg">👤</text>
              </view>
              <text class="flex-1 text-sm font-medium text-pink-600">{{ t('nav.login') }}</text>
              <wd-icon name="chevron-right" size="28rpx" color="#9ca3af" class="shrink-0" />
            </template>
          </view>
        </view>
      </view>
    </view>
    <!-- 主内容区 -->
    <view class="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-pink-50 via-white to-purple-50/30">
      <wd-navbar
        :title="breadcrumbTitle"
        fixed
        placeholder
        safe-area-inset-top
        bordered
      >
        <template #left>
          <view class="p-2" @click="toggleSidebar">
            <text class="text-2xl text-gray-700">☰</text>
          </view>
        </template>
      </wd-navbar>
      <!-- 内容区：父元素勿用 overflow-hidden，否则 scroll-view 无法滚动（见 uni-app 嵌套滚动问题） -->
      <view class="flex-1 min-h-0 flex flex-col">
        <view id="main-tab-panel" class="tab-panel flex-1 min-h-0 flex flex-col">
          <Studio v-if="currentTab === 'studio'" :embedded="true" />
          <MultiAngle v-else-if="currentTab === 'studio-multi'" :embedded="true" />
          <Wardrobe v-else-if="currentTab === 'wardrobe'" :embedded="true" />
          <TryonHistory v-else-if="currentTab === 'tryon-history'" :embedded="true" />
          <MultiAngleHistory v-else-if="currentTab === 'multiangle-history'" :embedded="true" />
          <Favorites v-else-if="currentTab === 'favorites'" :embedded="true" />
          <MyBlog v-else-if="currentTab === 'blog'" :embedded="true" />
          <Profile v-else-if="currentTab === 'profile'" :embedded="true" />
        </view>
      </view>
    </view>
    <!-- 移动端遮罩 -->
    <view v-if="sidebarVisible && isMobile" class="fixed inset-0 bg-black/40 z-[99]" @click="sidebarVisible = false" />
    <!-- 自定义 TabBar -->
    <CustomTabBar current-tab="index" />
  </view>
</template>

<script setup lang="ts">
definePage({
  style: {
    navigationStyle: 'custom',
  },
})
import { computed, ref, provide } from 'vue'
import { onLoad, onReady, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { supabase, type User } from '@/lib/supabase'
import Studio from '@/pages/studio/studio.vue'
import Wardrobe from '@/pages/wardrobe/wardrobe.vue'
import TryonHistory from '@/pages/tryon-history/tryon-history.vue'
import Profile from '@/pages/profile/profile.vue'
import Favorites from '@/pages/favorites/favorites.vue'
import MyBlog from '@/pages/my-blog/my-blog.vue'
import MultiAngle from '@/pages/multi-angle/multi-angle.vue'
import MultiAngleHistory from '@/pages/multiangle-history/multiangle-history.vue'
import CustomTabBar from '@/components/CustomTabBar.vue'

const { t } = useI18n()

const sidebarVisible = ref(true)
const activeIndex = ref(0)
const currentTab = ref<'studio' | 'studio-multi' | 'wardrobe' | 'tryon-history' | 'multiangle-history' | 'favorites' | 'blog' | 'profile'>('studio')
const studioOpen = ref(true)
const historyOpen = ref(false)

const isMobile = ref(false)
const user = ref<User | null>(null)
const hasToken = ref(false)

// 自定义 wd-navbar / wd-tabbar 需按实际占位计算：navbar 含 statusBarHeight，tabbar 含 safeBottom
const sysInfo = ref<UniApp.GetSystemInfoResult | null>(uni.getSystemInfoSync())
const pageHeightStyle = computed(() => {
  const s = sysInfo.value
  if (!s) return '100vh'
  const winH = s.windowHeight ?? s.screenHeight ?? 0
  const safeBottom = (s as { safeAreaInsets?: { bottom?: number } }).safeAreaInsets?.bottom ?? 0
  const tabBarH = 50
  return `${Math.max(0, winH - tabBarH - safeBottom)}px`
})
const mainScrollHeightFallback = computed(() => {
  const s = sysInfo.value
  if (!s) return '100%'
  const winH = s.windowHeight ?? s.screenHeight ?? 0
  const safeBottom = (s as { safeAreaInsets?: { bottom?: number } }).safeAreaInsets?.bottom ?? 0
  const tabBarH = 50
  const statusBarH = s.statusBarHeight ?? 0
  const navbarH = 44 + statusBarH
  const h = winH - navbarH - tabBarH - safeBottom
  return `${Math.max(100, h)}px`
})
const mainScrollHeight = ref<string>('100%')
provide('mainScrollHeight', () => mainScrollHeight.value || mainScrollHeightFallback.value)

function refreshMainScrollHeight() {
  mainScrollHeight.value = mainScrollHeightFallback.value
  uni.createSelectorQuery()
    .select('#main-tab-panel')
    .boundingClientRect((res) => {
      const rect = Array.isArray(res) ? res[0] : res
      if (rect && typeof rect.height === 'number' && rect.height > 0) {
        mainScrollHeight.value = `${rect.height}px`
      }
    })
    .exec()
}

const studioSubItems = [
  { value: 0, labelKey: 'nav.studioOutfit', tab: 'studio' as const },
  { value: 1, labelKey: 'nav.studioMultiAngle', tab: 'studio-multi' as const },
]
const historySubItems = [
  { value: 3, labelKey: 'nav.historyTryOn', tab: 'tryon-history' as const },
  { value: 4, labelKey: 'nav.historyMultiAngle', tab: 'multiangle-history' as const },
]
const profileItem = { value: 8, labelKey: 'nav.profile', tab: 'profile' as const }

const isStudioActive = computed(() => [0, 1].includes(activeIndex.value))
const isHistoryActive = computed(() => [3, 4].includes(activeIndex.value))

// 用户信息（对齐 SidebarNavUser）
const displayName = computed(() => {
  const u = user.value
  return (u?.user_metadata?.full_name as string) || u?.email?.split('@')[0] || ''
})
const displayEmail = computed(() => user.value?.email ?? '')
const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url as string | undefined)
const fallbackInitials = computed(() => {
  const email = displayEmail.value
  if (email.length >= 2) return email.slice(0, 2).toUpperCase()
  return email.slice(0, 1).toUpperCase() || '?'
})

const breadcrumbTitle = computed(() => {
  const map: Record<string, string> = {
    studio: t('nav.studio'),
    'studio-multi': t('nav.studioMultiAngle'),
    wardrobe: t('nav.wardrobe'),
    'tryon-history': t('nav.historyTryOn'),
    'multiangle-history': t('nav.historyMultiAngle'),
    favorites: t('nav.favorites'),
    blog: t('nav.myBlog'),
    profile: t('nav.profile'),
  }
  return map[currentTab.value] ?? 'Fashion Rec'
})

/** 需要登录才能访问的 tab（未登录仅可进入工作室：studio、studio-multi） */
const LOGIN_REQUIRED_TABS: readonly string[] = ['wardrobe', 'tryon-history', 'multiangle-history', 'favorites', 'blog', 'profile']

function onNavClick(item: { value: number; labelKey: string; tab: typeof currentTab.value }) {
  const needsLogin = LOGIN_REQUIRED_TABS.includes(item.tab)
  const hasToken = !!uni.getStorageSync('auth_token')
  if (needsLogin && !hasToken) {
    const redirect = '/pages/index/index?tab=' + encodeURIComponent(item.tab)
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(redirect) })
    return
  }
  activeIndex.value = item.value
  currentTab.value = item.tab
  if (isMobile.value) sidebarVisible.value = false
}

function onContact() {
  uni.setClipboardData({ data: 'support@fashion-rec.com' })
  uni.showToast({ title: t('nav.contact'), icon: 'none' })
}

/** 底部用户区点击：未登录跳转登录，已登录弹出 ActionSheet */
function onUserAreaClick() {
  if (!user.value) {
    uni.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/index/index') })
    return
  }
  uni.showActionSheet({
    itemList: [t('nav.profile'), t('nav.logout')],
    success: (res) => {
      if (res.tapIndex === 0) {
        onNavClick(profileItem)
      } else if (res.tapIndex === 1) {
        handleSignOut()
      }
    },
  })
}

async function handleSignOut() {
  try {
    await supabase.auth.signOut()
    uni.removeStorageSync('auth_token')
    uni.reLaunch({ url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/index/index') })
  } catch (e) {
    console.error('Failed to sign out', e)
    uni.showToast({ title: t('errors.authFailed') || 'Sign out failed', icon: 'none' })
  }
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
}

function switchToStudio() {
  currentTab.value = 'studio'
  activeIndex.value = 0
}
function switchToWardrobe() {
  currentTab.value = 'wardrobe'
  activeIndex.value = 2
}
provide('switchToStudio', switchToStudio)
provide('switchToWardrobe', switchToWardrobe)

async function fetchUser() {
  try {
    const { data: { user: u } } = await supabase.auth.getUser()
    user.value = u ?? null
    if (!u) uni.removeStorageSync('auth_token')
  } catch {
    user.value = null
    uni.removeStorageSync('auth_token')
  }
}

const TAB_TO_ACTIVE_INDEX: Record<string, number> = {
  studio: 0,
  'studio-multi': 1,
  wardrobe: 2,
  'tryon-history': 3,
  'multiangle-history': 4,
  favorites: 5,
  blog: 6,
  profile: 8,
}

onLoad((options) => {
  const tab = options?.tab as string
  if (tab && TAB_TO_ACTIVE_INDEX[tab] !== undefined) {
    const needsLogin = LOGIN_REQUIRED_TABS.includes(tab)
    const hasToken = !!uni.getStorageSync('auth_token')
    if (needsLogin && !hasToken) {
      return
    }
    currentTab.value = tab as typeof currentTab.value
    activeIndex.value = TAB_TO_ACTIVE_INDEX[tab]
  }
})

onReady(() => {
  // 延迟一帧，确保 flex 布局已计算完成
  setTimeout(refreshMainScrollHeight, 50)
})

onShow(() => {
  const sys = uni.getSystemInfoSync()
  sysInfo.value = sys
  const mobile = (sys.windowWidth ?? 0) < 768
  isMobile.value = mobile
  if (mobile) sidebarVisible.value = false
  const token = uni.getStorageSync('auth_token')
  hasToken.value = !!token
  if (token) {
    fetchUser()
  } else {
    user.value = null
  }
  refreshMainScrollHeight()
})
</script>

<style scoped>
.tab-panel {
  height: 100%;
  /* 勿用 overflow:hidden，会阻止内部 scroll-view 滚动 */
}
.sidebar-wrap {
  width: 18rem;
  min-width: 280px;
  background: #fff;
  border-right: 1px solid rgba(236, 72, 153, 0.2);
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: transform 0.2s;
}
@media (max-width: 768px) {
  .sidebar-wrap {
    position: fixed;
    left: 0;
    top: 0;
    bottom: calc(50px + env(safe-area-inset-bottom));
  }
  .sidebar-hidden {
    transform: translateX(-100%);
  }
}
</style>
