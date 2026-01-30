<script setup lang="ts">
/**
 * 侧栏底部用户区（参考 sidebar-08 NavUser）：头像 + 名称/邮箱 + 下拉（个人资料、退出登录）
 * 仅在有登录态时展示，不存在未登录分支。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  User,
  LogOut,
  ChevronsUpDown,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useSidebar()

const displayName = computed(() => {
  const u = authStore.user
  return (u?.user_metadata?.full_name as string) || u?.email?.split('@')[0] || ''
})

const displayEmail = computed(() => authStore.user?.email ?? '')

const avatarUrl = computed(() => authStore.user?.user_metadata?.avatar_url as string | undefined)

// 默认头像：邮箱前两个字符（仅登录态展示，必有邮箱）
const fallbackInitials = computed(() => {
  const email = displayEmail.value
  if (email.length >= 2) return email.slice(0, 2).toUpperCase()
  return email.slice(0, 1).toUpperCase() || '?'
})

const handleSignOut = async () => {
  try {
    await supabase.auth.signOut()
    router.push('/login')
  } catch (e) {
    console.error('Failed to sign out', e)
  }
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage :src="avatarUrl ?? ''" :alt="displayName" />
              <AvatarFallback class="rounded-lg bg-pink-100 text-pink-700">
                {{ fallbackInitials }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 min-w-0 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ displayName }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ displayEmail }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4 shrink-0" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg shadow-gray-200/50 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/20"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="4"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage :src="avatarUrl ?? ''" :alt="displayName" />
                <AvatarFallback class="rounded-lg bg-pink-100 text-pink-700">{{ fallbackInitials }}</AvatarFallback>
              </Avatar>
              <div class="grid flex-1 min-w-0 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ displayName }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ displayEmail }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator class="bg-gray-200 dark:bg-gray-700" />
          <DropdownMenuGroup>
            <DropdownMenuItem
              as-child
              class="cursor-pointer rounded-lg focus:bg-pink-50 focus:text-pink-700 dark:focus:bg-pink-950/40 dark:focus:text-pink-300"
            >
              <router-link to="/profile" class="flex items-center gap-2 px-2 py-2">
                <User class="size-4 shrink-0" />
                {{ t('nav.profile') }}
              </router-link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator class="bg-gray-200 dark:bg-gray-700" />
          <DropdownMenuItem
            class="cursor-pointer rounded-lg px-2 py-2 focus:bg-pink-50 focus:text-pink-700 dark:focus:bg-pink-950/40 dark:focus:text-pink-300"
            @click="handleSignOut"
          >
            <LogOut class="size-4 shrink-0" />
            {{ t('nav.logout') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
