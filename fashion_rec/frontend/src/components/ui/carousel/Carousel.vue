<script setup lang="ts">
import type { CarouselEmits, CarouselProps } from './interface'
import type { HTMLAttributes } from 'vue'
import { provide } from 'vue'
import { cn } from '@/lib/utils'
import CarouselPrevious from './CarouselPrevious.vue'
import CarouselNext from './CarouselNext.vue'
import { useProvideCarousel } from './useCarousel'

interface Props extends CarouselProps {
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  opts: undefined,
  plugins: undefined,
  orientation: 'horizontal',
})

const emits = defineEmits<CarouselEmits>()
const carousel = useProvideCarousel(props, emits)

provide('carouselApi', carousel.carouselApi)
provide('carouselRef', carousel.carouselRef)
provide('canScrollPrev', carousel.canScrollPrev)
provide('canScrollNext', carousel.canScrollNext)
provide('scrollPrev', carousel.scrollPrev)
provide('scrollNext', carousel.scrollNext)
</script>

<template>
  <div :class="cn('relative w-full', props.class)">
    <div ref="carousel.carouselRef" class="overflow-hidden">
      <slot />
    </div>
    <CarouselPrevious />
    <CarouselNext />
  </div>
</template>
