<script setup lang="ts">
import type { StepperSeparatorProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StepperSeparator, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<StepperSeparatorProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <StepperSeparator
    v-bind="forwardedProps"
    :class="cn(
      'shrink-0 bg-pink-100',
      'data-[orientation=vertical]:mx-2 data-[orientation=vertical]:min-h-3 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
      'data-[orientation=horizontal]:my-2 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full',
      props.class
    )"
  />
</template>
