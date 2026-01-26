<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('flex h-8 shrink-0 items-center px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider group-data-[state=collapsed]/sidebar-wrapper:hidden', $props.class)">
    <slot />
  </div>
</template>
