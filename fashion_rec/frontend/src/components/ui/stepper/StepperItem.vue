<script setup lang="ts">
import type { StepperItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StepperItem, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<StepperItemProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <StepperItem
    v-bind="forwardedProps"
    :class="cn('flex flex-col items-center gap-0', props.class)"
  >
    <slot />
  </StepperItem>
</template>
