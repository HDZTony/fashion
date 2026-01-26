<script setup lang="ts">
import { computed } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { Primitive, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'
import type { PrimitiveProps } from 'reka-ui'

interface Props extends PrimitiveProps {
  size?: 'default' | 'sm' | 'lg'
  isActive?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  size: 'default',
  isActive: false,
})

const delegatedProps = reactiveOmit(props, 'class', 'size', 'isActive')
const forwardedProps = useForwardProps(delegatedProps)

const buttonClass = computed(() =>
  cn(
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-sm',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2',
    'group-data-[state=collapsed]/sidebar-wrapper:w-10 group-data-[state=collapsed]/sidebar-wrapper:justify-center group-data-[state=collapsed]/sidebar-wrapper:px-0',
    props.isActive && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm',
    props.size === 'sm' && 'h-8 text-xs',
    props.size === 'lg' && 'h-12',
    props.size === 'default' && 'h-10',
    props.class
  )
)
</script>

<template>
  <Primitive :as="as" :as-child="asChild" v-bind="forwardedProps" :class="buttonClass">
    <slot />
  </Primitive>
</template>
