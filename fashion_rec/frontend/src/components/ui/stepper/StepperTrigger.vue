<script setup lang="ts">
import type { StepperTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StepperTrigger, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<StepperTriggerProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <StepperTrigger
    v-bind="forwardedProps"
    :class="cn(
      'group flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-center transition-colors duration-200 cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-pink-50 data-[state=active]:text-pink-700',
      'data-[state=completed]:text-gray-500',
      'data-[state=inactive]:text-gray-500',
      props.class
    )"
  >
    <slot />
  </StepperTrigger>
</template>
