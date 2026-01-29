<script setup lang="ts">
import type { StepperIndicatorProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StepperIndicator, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<StepperIndicatorProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <StepperIndicator
    v-bind="forwardedProps"
    :class="cn(
      'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-200',
      'group-data-[state=active]:border-pink-500 group-data-[state=active]:bg-pink-500 group-data-[state=active]:text-white',
      'group-data-[state=completed]:border-pink-400 group-data-[state=completed]:bg-pink-400 group-data-[state=completed]:text-white',
      'border-pink-200 bg-pink-50 text-pink-500',
      props.class
    )"
  >
    <slot />
  </StepperIndicator>
</template>
