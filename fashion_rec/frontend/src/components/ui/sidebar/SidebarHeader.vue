<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('flex h-16 shrink-0 items-center gap-2 px-4', $props.class)">
    <slot />
  </div>
</template>
