<template>
  <Sidebar collapsible="offcanvas" class="border-r border-pink-200">
    <div class="flex h-full flex-col px-[10px]" @click="onSidebarNavClick">
      <SidebarHeader class="!flex-col !h-auto !items-stretch gap-1 border-b border-pink-100 !px-0 py-2">
        <router-link to="/" class="flex items-center justify-center gap-2 px-2">
          <span class="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent group-data-[state=collapsed]/sidebar-wrapper:hidden">
            Fashion Rec
          </span>
          <span 
            v-if="!isLoadingVersion && currentVersion" 
            :class="[
              'px-2 py-0.5 text-xs font-semibold rounded-full group-data-[state=collapsed]/sidebar-wrapper:hidden',
              isV2 
                ? 'bg-pink-100 text-pink-700 border border-pink-200' 
                : 'bg-purple-50 text-purple-600 border border-purple-200'
            ]"
            :title="`Current version: ${currentVersion}`"
          >
            {{ isV2 ? 'V2' : 'Stable' }}
          </span>
        </router-link>
        <ModelSwitcher />
      </SidebarHeader>
      <SidebarContent class="flex-1 min-h-0 !px-0">
        <!-- Main: Studio, Wardrobe -->
        <SidebarGroup>
          <SidebarGroupLabel class="group-data-[state=collapsed]/sidebar-wrapper:hidden">
            {{ $t('nav.sidebarGroupMain') }}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible v-model:open="studioMenuOpen" class="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton :is-active="isStudioActive">
                      <Palette class="size-4 shrink-0" />
                      <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.studio') }}</span>
                      <ChevronRight class="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton as-child :is-active="isStudioChatNavActive">
                          <router-link to="/studio/chat">{{ $t('nav.studioChat') }}</router-link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton as-child :is-active="isActiveRoute('/multi-angle')">
                          <router-link to="/multi-angle">{{ $t('nav.studioMultiAngle') }}</router-link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActiveRoute('/wardrobe')">
                  <router-link to="/wardrobe">
                    <Shirt class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.wardrobe') }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <!-- History & Favorites -->
        <SidebarGroup>
          <SidebarGroupLabel class="group-data-[state=collapsed]/sidebar-wrapper:hidden">
            {{ $t('nav.sidebarGroupHistory') }}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible v-model:open="historyMenuOpen" class="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton :is-active="isHistoryActive">
                      <History class="size-4 shrink-0" />
                      <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.history') }}</span>
                      <ChevronRight class="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton as-child :is-active="isActiveRoute('/tryon-history')">
                          <router-link to="/tryon-history">{{ $t('nav.historyTryOn') }}</router-link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton as-child :is-active="isActiveRoute('/multiangle-history')">
                          <router-link to="/multiangle-history">{{ $t('nav.historyMultiAngle') }}</router-link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActiveRoute('/favorites')">
                  <router-link to="/favorites">
                    <Heart class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.favorites') }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActiveRoute('/my-blog')">
                  <router-link to="/my-blog">
                    <FileText class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.myBlog') }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <!-- Settings -->
        <SidebarGroup>
          <SidebarGroupLabel class="group-data-[state=collapsed]/sidebar-wrapper:hidden">
            {{ $t('nav.settings') }}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible v-model:open="settingsMenuOpen" class="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton :is-active="isSettingsActive">
                      <Settings class="size-4 shrink-0" />
                      <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.settings') }}</span>
                      <ChevronRight class="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton as-child :is-active="isActiveRoute('/settings/model')">
                          <router-link to="/settings/model">{{ $t('nav.settingsModel') }}</router-link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <!-- 次要导航（sidebar-08 Feedback 风格：无分组标题、小号按钮） -->
        <SidebarGroup class="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton as-child size="sm">
                  <a href="mailto:support@fashion-rec.com">
                    <Send class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.contact') }}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    <SidebarFooter class="border-t border-pink-100 shrink-0 group-data-[state=collapsed]/sidebar-wrapper:hidden">
      <SidebarNavUser />
    </SidebarFooter>
    </div>
  </Sidebar>

  <SidebarInset>
    <div class="flex min-h-screen min-h-0 flex-1 flex-col bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
      <!-- Top Navigation Bar -->
      <nav class="sticky top-0 z-40 w-full border-b border-pink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div class="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
          <div class="flex items-center gap-2 shrink-0 min-w-0">
            <SidebarTrigger class="-ml-1" />
            <Separator
              orientation="vertical"
              class="mr-2 h-4 shrink-0 hidden sm:block data-[orientation=vertical]:h-4"
            />
            <Breadcrumb class="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink as-child>
                    <router-link to="/">{{ $t('nav.home') }}</router-link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage class="line-clamp-1">{{ breadcrumbTitle }}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <!-- Mobile Logo -->
            <router-link to="/" class="flex items-center space-x-2 md:hidden shrink-0">
              <span class="text-xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Fashion Rec</span>
            </router-link>
          </div>
          <div class="flex items-center gap-4 shrink-0">
            <LanguageSwitcher />
          </div>
        </div>
      </nav>
      <main class="flex min-h-0 flex-1 flex-col">
        <!-- keep-alive：离开 AI 对话工作室再返回时保留会话与滚动，不整页缓存其它路由 -->
        <router-view v-slot="{ Component }">
          <keep-alive include="StudioChat">
            <component :is="Component" class="flex min-h-0 flex-1 flex-col" />
          </keep-alive>
        </router-view>
      </main>
    </div>
  </SidebarInset>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Heart, Send, Palette, Shirt, History, ChevronRight, FileText, Settings } from 'lucide-vue-next'
import SidebarNavUser from '@/components/SidebarNavUser.vue'
import ModelSwitcher from '@/components/ModelSwitcher.vue'
import { useVersion } from '@/composables/useVersion'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { useSidebar } from '@/components/ui/sidebar/useSidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'

const route = useRoute()
const router = useRouter()
const { isMobile, setOpenMobile } = useSidebar()
const { t } = useI18n()
const { currentVersion, getVersion, isV2, isLoading: isLoadingVersion } = useVersion()

// Breadcrumb title from current route (sidebar-08 style header)
const breadcrumbTitle = computed(() => {
  const path = route.path
  if (path === '/' || path === '') return 'Fashion Rec'
  if (path === '/studio/chat' || path.startsWith('/studio/chat/')) return t('studio.chat.title')
  if (path.startsWith('/studio')) return t('nav.studio')
  if (path.startsWith('/multi-angle')) return t('nav.studioMultiAngle')
  if (path.startsWith('/wardrobe')) return t('nav.wardrobe')
  if (path.startsWith('/tryon-history')) return t('nav.historyTryOn')
  if (path.startsWith('/multiangle-history')) return t('nav.historyMultiAngle')
  if (path.startsWith('/favorites')) return t('nav.favorites')
  if (path.startsWith('/my-blog')) return t('nav.myBlog')
  if (path.startsWith('/settings/model')) return t('nav.settingsModel')
  if (path.startsWith('/settings')) return t('nav.settings')
  if (path.startsWith('/profile')) return t('nav.profile')
  return (route.meta?.title as string) ?? route.name?.toString() ?? route.path
})

// Submenu states
const studioMenuOpen = ref(true)
const historyMenuOpen = ref(true)
const settingsMenuOpen = ref(false)

const isActiveRoute = (path: string) => {
  return computed(() => route.path === path || route.path.startsWith(path + '/')).value
}

// Check if any studio route is active
const isStudioActive = computed(() => {
  return (
    route.path === '/studio/chat' ||
    route.path === '/multi-angle' ||
    route.path.startsWith('/studio/') ||
    route.path.startsWith('/multi-angle/')
  )
})

const isStudioChatNavActive = computed(
  () => route.path === '/studio/chat' || route.path.startsWith('/studio/chat/'),
)

// Check if any history route is active
const isHistoryActive = computed(() => {
  return route.path === '/tryon-history' || route.path === '/multiangle-history' ||
         route.path.startsWith('/tryon-history/') || route.path.startsWith('/multiangle-history/')
})

// Check if any settings route is active
const isSettingsActive = computed(() => {
  return route.path.startsWith('/settings')
})

// 移动端：点击侧栏内任意导航并发生路由/跳转后自动折叠侧栏；桌面端不折叠
router.afterEach(() => {
  if (isMobile.value) {
    setOpenMobile(false)
  }
})

/** 移动端点击侧栏内任意链接（router-link 或 a）时折叠侧栏；点击展开按钮（工作室/历史）不折叠 */
function onSidebarNavClick(ev: MouseEvent) {
  if (!isMobile.value) return
  const link = (ev.target as Element).closest('a')
  if (link) setOpenMobile(false)
}

onMounted(async () => {
  await getVersion()
})
</script>
