<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { Ref } from 'vue'
import { inject } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const scrollNext = inject<() => void>('scrollNext')
const canScrollNext = inject<Ref<boolean>>('canScrollNext')
</script>

<template>
  <Button
    type="button"
    variant="outline"
    size="icon"
    :disabled="!canScrollNext"
    :class="cn('absolute h-8 w-8 rounded-full -right-12 top-1/2 -translate-y-1/2', props.class)"
    @click="scrollNext?.()"
  >
    <ChevronRight class="h-4 w-4" />
  </Button>
</template>
