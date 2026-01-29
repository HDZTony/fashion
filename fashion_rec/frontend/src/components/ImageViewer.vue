<script setup lang="ts">
defineOptions({ name: 'ImageViewer' })
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    images: string[]
    initialIndex?: number
    /** Optional: resolve URL before display (e.g. getLargeImageUrl). If not set, raw URL is used. */
    resolveUrl?: (url: string) => string
    alt?: string
  }>(),
  { initialIndex: 0, alt: 'Image' }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:currentIndex': [value: number]
}>()

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

const currentIndex = ref(0)
const zoom = ref(1)
// Pan (drag) offset in pixels when zoomed; no scrollbar, user drags to see overflow
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const panStartX = ref(0)
const panStartY = ref(0)
const panStartOffsetX = ref(0)
const panStartOffsetY = ref(0)

function imageSrc(url: string): string {
  return props.resolveUrl ? props.resolveUrl(url) : url
}

function close() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  emit('update:open', false)
}

function zoomIn() {
  zoom.value = Math.min(ZOOM_MAX, zoom.value + ZOOM_STEP)
}

function zoomOut() {
  zoom.value = Math.max(ZOOM_MIN, zoom.value - ZOOM_STEP)
}

function resetPan() {
  panX.value = 0
  panY.value = 0
}

function onPanStart(e: MouseEvent | TouchEvent) {
  if (zoom.value <= 1) return
  e.preventDefault()
  isPanning.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  panStartX.value = clientX
  panStartY.value = clientY
  panStartOffsetX.value = panX.value
  panStartOffsetY.value = panY.value
}

function onPanMove(e: MouseEvent | TouchEvent) {
  if (!isPanning.value || zoom.value <= 1) return
  e.preventDefault()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  panX.value = panStartOffsetX.value + (clientX - panStartX.value)
  panY.value = panStartOffsetY.value + (clientY - panStartY.value)
}

function onPanEnd() {
  isPanning.value = false
}

function next() {
  if (props.images.length <= 1) return
  const nextIndex = currentIndex.value < props.images.length - 1 ? currentIndex.value + 1 : 0
  currentIndex.value = nextIndex
  zoom.value = 1
  resetPan()
  emit('update:currentIndex', nextIndex)
}

function prev() {
  if (props.images.length <= 1) return
  const prevIndex = currentIndex.value > 0 ? currentIndex.value - 1 : props.images.length - 1
  currentIndex.value = prevIndex
  zoom.value = 1
  resetPan()
  emit('update:currentIndex', prevIndex)
}

function handleKeyDown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prev()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  }
}

watch(
  () => [props.open, props.initialIndex] as const,
  ([isOpen, idx]) => {
    if (isOpen) {
      currentIndex.value = Math.min(idx ?? 0, Math.max(0, props.images.length - 1))
      zoom.value = 1
      resetPan()
      emit('update:currentIndex', currentIndex.value)
    }
  }
)

// Global mouse/touch move and up so drag works when cursor leaves viewport
function onGlobalMove(e: MouseEvent | TouchEvent) {
  onPanMove(e)
}
function onGlobalEnd() {
  onPanEnd()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('mousemove', onGlobalMove)
  window.addEventListener('mouseup', onGlobalEnd)
  window.addEventListener('touchmove', onGlobalMove, { passive: false })
  window.addEventListener('touchend', onGlobalEnd)
  window.addEventListener('touchcancel', onGlobalEnd)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('mousemove', onGlobalMove)
  window.removeEventListener('mouseup', onGlobalEnd)
  window.removeEventListener('touchmove', onGlobalMove)
  window.removeEventListener('touchend', onGlobalEnd)
  window.removeEventListener('touchcancel', onGlobalEnd)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && images.length > 0"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="relative w-full h-full flex items-center justify-center p-4">
        <!-- Left slot (e.g. Wardrobe Info button) -->
        <div class="absolute top-4 left-4 z-10">
          <slot name="left-actions" />
        </div>

        <!-- Close button -->
        <button
          type="button"
          @click="close"
          class="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
          :aria-label="$t('common.close')"
        >
          <X class="w-6 h-6" />
        </button>

        <!-- Previous -->
        <button
          v-if="images.length > 1"
          type="button"
          @click="prev"
          class="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
        >
          <ChevronLeft class="w-6 h-6" />
        </button>

        <!-- Zoom controls -->
        <div
          class="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-2 py-1.5 z-10"
        >
          <button
            type="button"
            @click.stop="zoomOut"
            :disabled="zoom <= ZOOM_MIN"
            class="w-9 h-9 flex items-center justify-center text-white rounded-full hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            :title="$t('common.imageViewer.zoomOut')"
          >
            <ZoomOut class="w-5 h-5" />
          </button>
          <span class="text-white text-sm min-w-[3rem] text-center">{{ Math.round(zoom * 100) }}%</span>
          <button
            type="button"
            @click.stop="zoomIn"
            :disabled="zoom >= ZOOM_MAX"
            class="w-9 h-9 flex items-center justify-center text-white rounded-full hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            :title="$t('common.imageViewer.zoomIn')"
          >
            <ZoomIn class="w-5 h-5" />
          </button>
        </div>

        <!-- Image: no scrollbar; at 100% fit in view; when zoomed overflow is visible by drag (pan) -->
        <div
          class="max-w-4xl max-h-[90vh] w-full flex items-center justify-center overflow-hidden select-none touch-none"
          :class="{ 'cursor-grab': zoom > 1 && !isPanning, 'cursor-grabbing': zoom > 1 && isPanning }"
          @mousedown="onPanStart"
          @touchstart="onPanStart"
          @mouseleave="onPanEnd"
        >
          <div
            v-if="zoom <= 1"
            class="flex items-center justify-center rounded-lg shadow-2xl"
          >
            <img
              :src="imageSrc(images[currentIndex])"
              loading="lazy"
              :alt="alt"
              class="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg pointer-events-none"
              draggable="false"
            />
          </div>
          <div
            v-else
            class="flex items-center justify-center rounded-lg shadow-2xl origin-center will-change-transform"
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`
            }"
          >
            <img
              :src="imageSrc(images[currentIndex])"
              loading="lazy"
              :alt="alt"
              class="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg pointer-events-none"
              draggable="false"
            />
          </div>
        </div>

        <!-- Next -->
        <button
          v-if="images.length > 1"
          type="button"
          @click="next"
          class="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
        >
          <ChevronRight class="w-6 h-6" />
        </button>

        <!-- Counter -->
        <div
          v-if="images.length > 1"
          class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm"
        >
          {{ currentIndex + 1 }} / {{ images.length }}
        </div>
      </div>
    </div>
  </Teleport>
</template>
