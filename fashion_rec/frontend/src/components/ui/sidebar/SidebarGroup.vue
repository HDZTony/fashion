<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="cn('flex w-full flex-col gap-1', $props.class)">
    <slot />
  </div>
</template>
