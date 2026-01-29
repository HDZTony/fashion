<script setup lang="ts">
import type { StepperTitleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StepperTitle, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<StepperTitleProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <StepperTitle
    v-bind="forwardedProps"
    :class="cn('text-xs font-semibold leading-tight text-gray-900', props.class)"
  >
    <slot />
  </StepperTitle>
</template>
