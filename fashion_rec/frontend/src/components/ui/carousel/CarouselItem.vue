<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="cn('min-w-0 flex-[0_0_100%] pl-4', props.class)"
  >
    <slot />
  </div>
</template>
