<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import { ref, watch, provide, computed } from 'vue'
import { cn } from '@/lib/utils'
import CarouselPrevious from './CarouselPrevious.vue'
import CarouselNext from './CarouselNext.vue'

interface Props {
  opts?: Record<string, unknown>
  plugins?: unknown[]
  orientation?: 'horizontal' | 'vertical'
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  opts: undefined,
  plugins: undefined,
  orientation: 'horizontal',
})

const emblaOpts = computed(() => ({
  ...props.opts,
  axis: props.orientation === 'horizontal' ? 'x' as const : 'y' as const,
}))

const [emblaRef, emblaApi] = useEmblaCarousel(emblaOpts, props.plugins)

const canScrollPrev = ref(false)
const canScrollNext = ref(false)

const updateScrollState = () => {
  const api = emblaApi.value
  if (!api) return
  canScrollPrev.value = api.canScrollPrev()
  canScrollNext.value = api.canScrollNext()
}

watch(emblaApi, (api) => {
  if (!api) return
  updateScrollState()
  api.on('select', updateScrollState)
  api.on('reInit', updateScrollState)
}, { immediate: true })

const scrollPrev = () => emblaApi.value?.scrollPrev()
const scrollNext = () => emblaApi.value?.scrollNext()

provide('carouselApi', emblaApi)
provide('carouselRef', emblaRef)
provide('canScrollPrev', canScrollPrev)
provide('canScrollNext', canScrollNext)
provide('scrollPrev', scrollPrev)
provide('scrollNext', scrollNext)
</script>

<template>
  <div :class="cn('relative w-full', props.class)">
    <div ref="emblaRef" class="overflow-hidden">
      <slot />
    </div>
    <CarouselPrevious />
    <CarouselNext />
  </div>
</template>
