<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { Ref } from 'vue'
import { inject } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const scrollPrev = inject<() => void>('scrollPrev')
const canScrollPrev = inject<Ref<boolean>>('canScrollPrev')
</script>

<template>
  <Button
    type="button"
    variant="outline"
    size="icon"
    :disabled="!canScrollPrev"
    :class="cn('absolute h-8 w-8 rounded-full -left-12 top-1/2 -translate-y-1/2', props.class)"
    @click="scrollPrev?.()"
  >
    <ChevronLeft class="h-4 w-4" />
  </Button>
</template>
