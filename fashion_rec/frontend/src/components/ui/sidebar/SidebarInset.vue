<script setup lang="ts">
import { computed } from 'vue'
import { useSidebar } from './useSidebar'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
}>()

const sidebar = useSidebar()
const open = computed(() => sidebar.open.value)
const isMobile = computed(() => sidebar.isMobile.value)
</script>

<template>
  <main :class="cn('relative flex flex-1 flex-col transition-all duration-300', !isMobile && open ? 'md:ml-64' : 'md:ml-16', $props.class)">
    <slot />
  </main>
</template>
