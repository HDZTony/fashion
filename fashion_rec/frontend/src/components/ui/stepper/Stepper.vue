<script setup lang="ts">
import type { StepperRootEmits, StepperRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { StepperRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<StepperRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<StepperRootEmits>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <StepperRoot
    v-bind="forwarded"
    :class="cn('flex w-full', props.orientation === 'vertical' ? 'flex-col' : 'flex-row', props.class)"
  >
    <slot />
  </StepperRoot>
</template>
