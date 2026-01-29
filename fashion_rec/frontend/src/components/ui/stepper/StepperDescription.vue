<script setup lang="ts">
import type { StepperDescriptionProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StepperDescription, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<StepperDescriptionProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <StepperDescription
    v-bind="forwardedProps"
    :class="cn('text-[11px] text-pink-500 leading-tight', props.class)"
  >
    <slot />
  </StepperDescription>
</template>
