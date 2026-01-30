<template>
  <Sidebar collapsible="offcanvas" class="border-r border-pink-200">
    <div class="flex h-full flex-col px-[10px]" @click="onSidebarNavClick">
      <SidebarHeader class="p-4 border-b border-pink-100 justify-center text-center !px-0">
        <router-link to="/" class="flex items-center justify-center gap-2">
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
                        <SidebarMenuSubButton as-child :is-active="isActiveRoute('/studio')">
                          <router-link to="/studio">{{ $t('nav.studioOutfit') }}</router-link>
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
    <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
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
          <!-- 推荐穿搭步骤条：shadcn Stepper，Separator 放在 Item 内 + v-if，单向 model-value 防递归 -->
          <div v-if="isStudioRoute" class="flex-1 flex items-center justify-center min-w-0 max-w-2xl mx-auto" aria-label="Try-on flow progress">
            <Stepper
              :model-value="stepperStepNumber"
              orientation="horizontal"
              :linear="true"
              class="flex w-full flex-row items-center gap-0"
            >
              <StepperItem
                v-for="item in studioStepperSteps"
                :key="item.step"
                :step="item.step"
                :completed="item.completed"
                class="relative flex flex-1 flex-col items-center justify-center min-w-0"
              >
                <StepperTrigger class="relative z-10 cursor-pointer flex flex-col items-center gap-1 px-2 py-1 rounded-lg hover:bg-pink-50 transition-colors">
                  <StepperIndicator class="bg-muted">
                    {{ item.step }}
                  </StepperIndicator>
                </StepperTrigger>
                <!-- 左右不额外留间距；右端不超出 3：仅略伸入下一列以连接圆 -->
                <StepperSeparator
                  v-if="item.step !== studioStepperSteps[studioStepperSteps.length - 1]?.step"
                  class="absolute left-[calc(50%)] right-[calc(-50%)] top-[10px] -translate-y-1/2 z-0 block h-0.5 shrink-0 rounded-full bg-pink-200 my-0 w-auto"
                />
                <StepperTitle class="text-xs text-center">
                  {{ $t(item.titleKey) }}
                </StepperTitle>
              </StepperItem>
            </Stepper>
          </div>
          <div class="flex items-center gap-4 shrink-0">
            <LanguageSwitcher />
          </div>
        </div>
      </nav>
      <main>
        <router-view />
      </main>
    </div>
  </SidebarInset>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Heart, Send, Palette, Shirt, History, ChevronRight, FileText } from 'lucide-vue-next'
import SidebarNavUser from '@/components/SidebarNavUser.vue'
import { useVersion } from '@/composables/useVersion'
import { useStudioStore } from '@/stores/studio'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { useSidebar } from '@/components/ui/sidebar/useSidebar'
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
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
const studioStore = useStudioStore()
const { currentVersion, getVersion, isV2, isLoading: isLoadingVersion } = useVersion()

const isStudioRoute = computed(() => route.name === 'studio')

// Breadcrumb title from current route (sidebar-08 style header)
const breadcrumbTitle = computed(() => {
  const path = route.path
  if (path === '/' || path === '') return 'Fashion Rec'
  if (path.startsWith('/studio')) return t('nav.studio')
  if (path.startsWith('/multi-angle')) return t('nav.studioMultiAngle')
  if (path.startsWith('/wardrobe')) return t('nav.wardrobe')
  if (path.startsWith('/tryon-history')) return t('nav.historyTryOn')
  if (path.startsWith('/multiangle-history')) return t('nav.historyMultiAngle')
  if (path.startsWith('/favorites')) return t('nav.favorites')
  if (path.startsWith('/my-blog')) return t('nav.myBlog')
  if (path.startsWith('/profile')) return t('nav.profile')
  return (route.meta?.title as string) ?? route.name?.toString() ?? route.path
})

// 单向 model-value 用数字，避免 store 水合时 Stepper 内部 watch 触发递归
const stepperStepNumber = computed(() => Number(studioStore.stepperStep))
const studioStepperSteps = computed(() => [
  { step: 1, completed: studioStore.step1Completed, titleKey: 'studio.stepper.step1Title' },
  { step: 2, completed: studioStore.step2Completed, titleKey: 'studio.stepper.step2Title' },
  { step: 3, completed: studioStore.step3Completed, titleKey: 'studio.stepper.step3Title' },
])

// Submenu states
const studioMenuOpen = ref(true)
const historyMenuOpen = ref(true)

const isActiveRoute = (path: string) => {
  return computed(() => route.path === path || route.path.startsWith(path + '/')).value
}

// Check if any studio route is active
const isStudioActive = computed(() => {
  return route.path === '/studio' || route.path === '/multi-angle' ||
         route.path.startsWith('/studio/') || route.path.startsWith('/multi-angle/')
})

// Check if any history route is active
const isHistoryActive = computed(() => {
  return route.path === '/tryon-history' || route.path === '/multiangle-history' ||
         route.path.startsWith('/tryon-history/') || route.path.startsWith('/multiangle-history/')
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
