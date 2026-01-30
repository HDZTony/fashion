<script setup lang="ts">
import { computed } from 'vue'
import { useSidebar } from './useSidebar'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
}>()

const sidebar = useSidebar()
const open = computed(() => sidebar.open.value)
const openMobile = computed(() => sidebar.openMobile.value)
const isMobile = computed(() => sidebar.isMobile.value)
const collapsible = computed(() => sidebar.collapsible?.value ?? 'icon')

// 移动端且侧栏打开时显示遮罩（阴影 + 点击关闭）
const showMobileOverlay = computed(() => isMobile.value && openMobile.value)

const closeMobileSidebar = () => {
  if (isMobile.value) sidebar.setOpenMobile(false)
}

// 侧栏打开：留出 208px；关闭时 offcanvas=完全隐藏(0)，icon=图标条(64px)。移动端主内容始终全宽(侧栏 overlay)
const insetMarginClass = computed(() => {
  if (isMobile.value) return 'ml-0'
  if (open.value) return 'md:ml-[208px]'
  return collapsible.value === 'offcanvas' ? 'md:ml-0' : 'md:ml-16'
})
</script>

<template>
  <main :class="cn('relative flex flex-1 flex-col transition-all duration-300', insetMarginClass, $props.class)">
    <!-- 手机模式：侧栏打开时显示半透明遮罩，点击遮罩关闭侧栏 -->
    <Transition name="sidebar-overlay">
      <button
        v-if="showMobileOverlay"
        type="button"
        class="fixed inset-0 z-[45] bg-black/50 backdrop-blur-[2px] md:hidden"
        aria-label="Close sidebar"
        @click="closeMobileSidebar"
      />
    </Transition>
    <slot />
  </main>
</template>

<style scoped>
.sidebar-overlay-enter-active,
.sidebar-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.sidebar-overlay-enter-from,
.sidebar-overlay-leave-to {
  opacity: 0;
}
</style>
