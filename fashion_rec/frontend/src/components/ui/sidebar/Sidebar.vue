<script setup lang="ts">
import { computed } from 'vue'
import { useSidebar } from './useSidebar'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    side?: 'left' | 'right'
    variant?: 'sidebar' | 'floating' | 'inset'
    collapsible?: 'offcanvas' | 'icon' | 'none'
    class?: string
  }>(),
  {
    side: 'left',
    variant: 'sidebar',
    collapsible: 'offcanvas',
  }
)

const sidebar = useSidebar()
const open = computed(() => sidebar.open.value)
const openMobile = computed(() => sidebar.openMobile.value)
const isMobile = computed(() => sidebar.isMobile.value)

// Determine if sidebar should be visible
const isOpen = computed(() => {
  return isMobile.value ? openMobile.value : open.value
})

const sidebarClass = computed(() => {
  const baseClasses = [
    'group peer fixed z-50 h-screen shrink-0 bg-sidebar transition-all duration-300 ease-linear',
    'shadow-xl backdrop-blur-md',
    props.variant === 'floating' && 'm-2 rounded-lg shadow-lg',
    props.variant === 'inset' && 'bg-transparent',
    props.side === 'right' && 'right-0',
  ]
  
  // Width and visibility based on state (expanded: 208px; collapsed: icon only)
  if (isMobile.value) {
    baseClasses.push(
      'w-[208px] max-w-[208px] min-w-[5rem]',
      !isOpen.value && '-translate-x-full'
    )
  } else if (props.collapsible === 'icon') {
    if (isOpen.value) {
      baseClasses.push('w-[208px] max-w-[208px] min-w-[5rem]')
    } else {
      baseClasses.push('w-16')
    }
  } else if (props.collapsible === 'offcanvas') {
    baseClasses.push(
      'w-[208px] max-w-[208px] min-w-[5rem]',
      !isOpen.value && '-translate-x-full'
    )
  } else {
    baseClasses.push('w-[208px] max-w-[208px] min-w-[5rem]')
  }
  
  return cn(...baseClasses, props.class)
})

const sidebarDataState = computed(() => {
  if (isMobile.value) {
    return openMobile.value ? 'open' : 'closed'
  }
  if (props.collapsible === 'icon') {
    return open.value ? 'open' : 'collapsed'
  }
  return open.value ? 'open' : 'closed'
})
</script>

<template>
  <aside :class="sidebarClass" :data-state="sidebarDataState" data-sidebar="sidebar">
    <slot />
  </aside>
</template>
