<template>
  <SidebarProvider :default-open="true">
    <Sidebar collapsible="icon" class="border-r border-pink-200">
      <div class="flex h-full flex-col px-[10px]">
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
        <SidebarContent class="!px-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <!-- Studio with Submenu -->
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
              
              <!-- Wardrobe -->
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActiveRoute('/wardrobe')">
                  <router-link to="/wardrobe">
                    <Shirt class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.wardrobe') }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <!-- History with Submenu -->
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
              
              <!-- Favorites -->
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActiveRoute('/favorites')">
                  <router-link to="/favorites">
                    <Heart class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.favorites') }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <!-- My Blog -->
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActiveRoute('/my-blog')">
                  <router-link to="/my-blog">
                    <FileText class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.myBlog') }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <!-- Contact Us -->
              <SidebarMenuItem>
                <SidebarMenuButton as-child>
                  <a href="mailto:support@fashion-rec.com">
                    <Mail class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.contact') }}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <!-- Profile -->
              <SidebarMenuItem>
                <SidebarMenuButton as-child :is-active="isActiveRoute('/profile')">
                  <router-link to="/profile">
                    <User class="size-4 shrink-0" />
                    <span class="group-data-[state=collapsed]/sidebar-wrapper:hidden">{{ $t('nav.profile') }}</span>
                  </router-link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        </SidebarContent>
      </div>
      <SidebarRail />
    </Sidebar>
    
    <SidebarInset>
      <div class="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50 font-sans text-gray-900">
        <!-- Top Navigation Bar -->
        <nav class="sticky top-0 z-40 w-full border-b border-pink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div class="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div class="flex items-center gap-2">
              <SidebarTrigger class="-ml-1" />
              <!-- Mobile Logo -->
              <router-link to="/" class="flex items-center space-x-2 md:hidden">
                <span class="text-xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">Fashion Rec</span>
              </router-link>
            </div>
            <div class="flex items-center gap-4">
              <LanguageSwitcher />
            </div>
          </div>
        </nav>
        <main>
          <router-view />
        </main>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Heart, User, Mail, Palette, Shirt, History, ChevronRight, FileText } from 'lucide-vue-next'
import { useVersion } from '@/composables/useVersion'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
} from '@/components/ui/sidebar'

const route = useRoute()
const { currentVersion, getVersion, isV2, isLoading: isLoadingVersion } = useVersion()

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

onMounted(async () => {
  await getVersion()
})
</script>
