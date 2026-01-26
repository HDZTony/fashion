<script setup lang="ts">
import { computed } from 'vue'
import { Menu, X } from 'lucide-vue-next'
import { useSidebar } from './useSidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
}>()

const sidebar = useSidebar()

const isOpen = computed(() => {
  return sidebar.isMobile.value ? sidebar.openMobile.value : sidebar.open.value
})

const handleToggle = () => {
  sidebar.toggleSidebar()
}
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    :class="cn('h-8 w-8 rounded-lg hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors', props.class)"
    @click="handleToggle"
  >
    <Menu v-if="!isOpen" class="h-5 w-5 text-sidebar-foreground" />
    <X v-else class="h-5 w-5 text-sidebar-foreground" />
    <span class="sr-only">Toggle Sidebar</span>
  </Button>
</template>
