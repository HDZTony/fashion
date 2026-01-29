<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    class="flex -ml-4"
    style="touch-action: pan-y pinch-zoom"
    :class="props.class"
  >
    <slot />
  </div>
</template>
