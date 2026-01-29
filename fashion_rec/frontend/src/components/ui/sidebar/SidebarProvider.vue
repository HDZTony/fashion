<script setup lang="ts">
import { provide, ref, watch, computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'

export interface SidebarContext {
  state: 'expanded' | 'collapsed'
  open: boolean
  openMobile: boolean
  isMobile: boolean
  setOpen: (open: boolean) => void
  setOpenMobile: (open: boolean) => void
  toggleSidebar: () => void
}

const props = withDefaults(
  defineProps<{
    defaultOpen?: boolean
    open?: boolean | null  // 使用 null 作为"未传递"的标记，避免 Vue 3 的布尔规范化问题
    storageKey?: string
  }>(),
  {
    defaultOpen: true,
    storageKey: 'sidebar:state',
    open: null,  // 明确设置默认值为 null，这样未传递时就是 null
  }
)

const emits = defineEmits<{
  'update:open': [open: boolean]
}>()

const isMobile = useMediaQuery('(max-width: 768px)')
const internalOpen = ref(props.defaultOpen)
const openMobile = ref(false)

// Check if component is controlled (open prop explicitly provided)
// Using null as default value makes it easy to detect if prop was passed
// null = not passed (uncontrolled), boolean = passed (controlled)
const isControlled = props.open !== null

const open = computed({
  get: () => (isControlled ? props.open as boolean : internalOpen.value),
  set: (value) => {
    if (!isControlled) {
      internalOpen.value = value
    }
    emits('update:open', value)
  },
})

const state = computed<'expanded' | 'collapsed'>(() => {
  return open.value ? 'expanded' : 'collapsed'
})

const setOpen = (value: boolean) => {
  open.value = value
}

const setOpenMobile = (value: boolean) => {
  openMobile.value = value
}

const toggleSidebar = () => {
  if (isMobile.value) {
    openMobile.value = !openMobile.value
  } else {
    open.value = !open.value
  }
}


// Auto-close on mobile (only if not controlled)
watch(isMobile, (mobile) => {
  if (mobile && !isControlled) {
    open.value = false
  }
})

// Create reactive context - use refs for reactivity
const contextRefs = {
  state,
  open,
  openMobile,
  isMobile: computed(() => isMobile.value),
  setOpen,
  setOpenMobile,
  toggleSidebar,
}

provide('sidebar', contextRefs)
</script>

<template>
  <div 
    class="group/sidebar-wrapper peer" 
    :data-state="isMobile ? (openMobile ? 'open' : 'closed') : (open ? 'open' : 'collapsed')"
  >
    <slot />
  </div>
</template>
