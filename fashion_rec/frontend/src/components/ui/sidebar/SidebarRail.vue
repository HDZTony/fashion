<script setup lang="ts">
import { computed } from 'vue'
import { useSidebar } from './useSidebar'
import { cn } from '@/lib/utils'

const sidebar = useSidebar()
const isMobile = computed(() => sidebar.isMobile.value)
</script>

<template>
  <div
    v-if="!isMobile"
    :class="
      cn(
        'absolute inset-y-0 z-50 hidden w-12 -translate-x-full transition-all duration-300 ease-linear peer-data-[state=collapsed]/sidebar-wrapper:translate-x-0 peer-data-[state=collapsed]/sidebar-wrapper:block',
        'group peer pointer-events-none',
        '[&_*]:pointer-events-auto'
      )
    "
    data-sidebar="rail"
  >
    <div
      :class="
        cn(
          'flex h-full w-12 flex-col items-center gap-2 bg-sidebar p-2',
          'group-data-[side=left]/sidebar-wrapper:',
          'group-data-[side=right]/sidebar-wrapper:'
        )
      "
    >
      <slot />
    </div>
  </div>
</template>
