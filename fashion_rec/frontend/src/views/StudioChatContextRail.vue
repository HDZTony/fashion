<script setup lang="ts">
/**
 * Left / top rail: studio base items + **intent-cropped** thumbnails per user message.
 * Hover/tap: 入库 (wardrobe) / 删除 (remove from chat try-on context).
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { StudioChatMessage } from '@/composables/useStudioChatKit'

import { Loader } from '@/components/ai-elements/loader'
import { getThumbnailUrl } from '@/lib/imageOptimizer'

export type StudioContextThumb = {
  key: string
  url: string
  itemId: string
  source: 'wardrobe' | 'selected'
}

const props = defineProps<{
  studioThumbs: StudioContextThumb[]
  /** Effective try-on scene (Qwen image 3), same as ChatKit header resolution */
  sceneBackgroundUrl?: string | null
  messages: StudioChatMessage[]
  intentCropUrlsByMessageId: Record<string, string[]>
  intentCropLoading: Record<string, boolean>
  intentCropFailed: Record<string, boolean>
  excludedTryOnGarmentUrls: string[]
}>()

const emit = defineEmits<{
  addToWardrobe: [url: string]
  excludeTryOnUrl: [url: string]
  excludeSceneBackground: [url: string]
  removeStudioItem: [payload: { itemId: string; source: 'wardrobe' | 'selected' }]
}>()

const { t } = useI18n()

function normUrl(u: string): string {
  return (u || '').trim().replace(/\/$/, '')
}

const excludedSet = computed(() => new Set(props.excludedTryOnGarmentUrls.map(normUrl)))

/** Hide scene thumb after load error (e.g. 404, blocked), avoids empty bordered box */
const sceneBackgroundLoadFailed = ref(false)
watch(
  () => props.sceneBackgroundUrl,
  () => {
    sceneBackgroundLoadFailed.value = false
  },
)

function onSceneBackgroundImgError() {
  sceneBackgroundLoadFailed.value = true
}

function messageHasServerImage(m: StudioChatMessage): boolean {
  return m.imageUrls.some((u) => /^https?:\/\//i.test((u || '').trim()))
}

type RailEntry =
  | { kind: 'background'; key: string; url: string }
  | { kind: 'studio'; key: string; url: string; itemId: string; source: 'wardrobe' | 'selected' }
  | { kind: 'crop'; key: string; url: string }
  | { kind: 'loading'; key: string }
  | { kind: 'empty'; key: string }

const leftRailEntries = computed((): RailEntry[] => {
  const out: RailEntry[] = []
  const ex = excludedSet.value

  const scene = (props.sceneBackgroundUrl ?? '').trim()
  if (scene && !sceneBackgroundLoadFailed.value)
    out.push({ kind: 'background', key: 'ctx-scene-bg', url: scene })

  for (const g of props.studioThumbs) {
    if (ex.has(normUrl(g.url)))
      continue
    out.push({
      kind: 'studio',
      key: `s-${g.key}`,
      url: g.url,
      itemId: g.itemId,
      source: g.source,
    })
  }

  for (const m of props.messages) {
    if (m.role !== 'user' || !messageHasServerImage(m))
      continue
    const uid = m.id
    if (props.intentCropLoading[uid]) {
      out.push({ kind: 'loading', key: `ld-${uid}` })
      continue
    }
    if (props.intentCropFailed[uid]) {
      out.push({ kind: 'empty', key: `e-${uid}` })
      continue
    }
    if (Object.prototype.hasOwnProperty.call(props.intentCropUrlsByMessageId, uid)) {
      const crops = props.intentCropUrlsByMessageId[uid] ?? []
      const visible = crops.filter((u) => u && !ex.has(normUrl(u)))
      if (visible.length > 0) {
        visible.forEach((url) => {
          out.push({ kind: 'crop', key: `c-${uid}-${url}`, url })
        })
      }
      else if (crops.length > 0) {
        /* all crops excluded — skip row */
      }
      else {
        out.push({ kind: 'empty', key: `e-${uid}-empty` })
      }
      continue
    }
    out.push({ kind: 'loading', key: `ld-${uid}` })
  }
  return out
})

function onAddToWardrobe(url: string) {
  emit('addToWardrobe', url)
}

function onExcludeTryOn(url: string) {
  emit('excludeTryOnUrl', url)
}

function onExcludeSceneBackground(url: string) {
  emit('excludeSceneBackground', url)
}

function onRemoveStudio(e: RailEntry & { kind: 'studio' }) {
  emit('removeStudioItem', { itemId: e.itemId, source: e.source })
}

function showAddForStudio(e: RailEntry): boolean {
  return e.kind === 'studio' && e.source === 'selected'
}
</script>

<template>
  <template v-if="leftRailEntries.length > 0">
    <div
      class="flex shrink-0 gap-2 overflow-x-auto border-b border-pink-100/80 bg-pink-50/50 px-2 py-2 sm:hidden"
      :title="t('studio.chat.contextGarmentsRail.hint')"
    >
      <div class="flex shrink-0 flex-col justify-center pr-1">
        <span class="max-w-[4.5rem] text-[10px] font-medium leading-tight text-pink-900/85">
          {{ t('studio.chat.contextGarmentsRail.title') }}
        </span>
      </div>
      <template
        v-for="e in leftRailEntries"
        :key="`m-${e.key}`"
      >
        <div
          v-if="e.kind === 'background'"
          class="group relative size-14 shrink-0"
        >
          <img
            :src="getThumbnailUrl(e.url)"
            alt=""
            class="size-14 rounded-lg border border-sky-100 object-cover shadow-sm ring-2 ring-sky-300/75"
            loading="lazy"
            decoding="async"
            :title="t('studio.chat.contextGarmentsRail.sceneBackgroundHint')"
            @error="onSceneBackgroundImgError"
          >
          <div
            class="absolute inset-0 flex flex-col items-stretch justify-center gap-0.5 rounded-lg bg-black/55 p-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <button
              type="button"
              class="rounded bg-white/95 px-0.5 py-px text-[8px] font-medium leading-tight text-pink-950 shadow hover:bg-pink-50"
              @click.stop="onAddToWardrobe(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.addToWardrobe') }}
            </button>
            <button
              type="button"
              class="rounded bg-white/95 px-0.5 py-px text-[8px] font-medium leading-tight text-red-900 shadow hover:bg-red-50"
              @click.stop="onExcludeSceneBackground(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.removeFromChat') }}
            </button>
          </div>
        </div>
        <div
          v-else-if="e.kind === 'studio' || e.kind === 'crop'"
          class="group relative size-14 shrink-0"
        >
          <img
            :src="e.url"
            alt=""
            class="size-14 rounded-lg border border-pink-100 object-cover shadow-sm"
            :class="e.kind === 'crop' ? 'ring-2 ring-pink-200/90' : ''"
            loading="lazy"
            decoding="async"
          >
          <div
            class="absolute inset-0 flex flex-col items-stretch justify-center gap-0.5 rounded-lg bg-black/55 p-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <button
              v-if="e.kind === 'crop' || showAddForStudio(e)"
              type="button"
              class="rounded bg-white/95 px-0.5 py-px text-[8px] font-medium leading-tight text-pink-950 shadow hover:bg-pink-50"
              @click.stop="onAddToWardrobe(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.addToWardrobe') }}
            </button>
            <button
              v-if="e.kind === 'crop'"
              type="button"
              class="rounded bg-white/95 px-0.5 py-px text-[8px] font-medium leading-tight text-red-900 shadow hover:bg-red-50"
              @click.stop="onExcludeTryOn(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.removeFromChat') }}
            </button>
            <button
              v-else
              type="button"
              class="rounded bg-white/95 px-0.5 py-px text-[8px] font-medium leading-tight text-red-900 shadow hover:bg-red-50"
              @click.stop="onRemoveStudio(e)"
            >
              {{ t('studio.chat.contextGarmentsRail.removeFromChat') }}
            </button>
          </div>
        </div>
        <div
          v-else-if="e.kind === 'loading'"
          class="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-pink-200 bg-white/80"
        >
          <Loader class="size-5 text-pink-400" />
        </div>
        <div
          v-else
          class="flex size-14 shrink-0 items-center justify-center rounded-lg border border-pink-100 bg-amber-50/90 px-1 text-center text-[8px] leading-tight text-amber-900"
        >
          {{ t('studio.chat.contextGarmentsRail.noCropHint') }}
        </div>
      </template>
    </div>
    <aside
      class="hidden w-[84px] shrink-0 flex-col gap-2 overflow-y-auto border-pink-100/80 bg-pink-50/50 px-2 py-3 sm:flex sm:border-r"
      :title="t('studio.chat.contextGarmentsRail.hint')"
    >
      <p
        class="select-none text-center text-[10px] font-semibold leading-tight text-pink-950/90"
      >
        {{ t('studio.chat.contextGarmentsRail.title') }}
      </p>
      <template
        v-for="e in leftRailEntries"
        :key="`d-${e.key}`"
      >
        <div
          v-if="e.kind === 'background'"
          class="group relative w-full"
        >
          <img
            :src="getThumbnailUrl(e.url)"
            alt=""
            class="aspect-square w-full rounded-lg border border-sky-100 object-cover shadow-sm ring-2 ring-sky-300/75"
            loading="lazy"
            decoding="async"
            :title="t('studio.chat.contextGarmentsRail.sceneBackgroundHint')"
            @error="onSceneBackgroundImgError"
          >
          <div
            class="absolute inset-0 flex flex-col items-stretch justify-center gap-0.5 rounded-lg bg-black/55 p-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <button
              type="button"
              class="rounded bg-white/95 px-0.5 py-0.5 text-[8px] font-medium leading-tight text-pink-950 shadow hover:bg-pink-50"
              @click.stop="onAddToWardrobe(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.addToWardrobe') }}
            </button>
            <button
              type="button"
              class="rounded bg-white/95 px-0.5 py-0.5 text-[8px] font-medium leading-tight text-red-900 shadow hover:bg-red-50"
              @click.stop="onExcludeSceneBackground(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.removeFromChat') }}
            </button>
          </div>
        </div>
        <div
          v-else-if="e.kind === 'studio' || e.kind === 'crop'"
          class="group relative w-full"
        >
          <img
            :src="e.url"
            alt=""
            class="aspect-square w-full rounded-lg border border-pink-100 object-cover shadow-sm"
            :class="e.kind === 'crop' ? 'ring-2 ring-pink-200/90' : ''"
            loading="lazy"
            decoding="async"
          >
          <div
            class="absolute inset-0 flex flex-col items-stretch justify-center gap-0.5 rounded-lg bg-black/55 p-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <button
              v-if="e.kind === 'crop' || showAddForStudio(e)"
              type="button"
              class="rounded bg-white/95 px-0.5 py-0.5 text-[8px] font-medium leading-tight text-pink-950 shadow hover:bg-pink-50"
              @click.stop="onAddToWardrobe(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.addToWardrobe') }}
            </button>
            <button
              v-if="e.kind === 'crop'"
              type="button"
              class="rounded bg-white/95 px-0.5 py-0.5 text-[8px] font-medium leading-tight text-red-900 shadow hover:bg-red-50"
              @click.stop="onExcludeTryOn(e.url)"
            >
              {{ t('studio.chat.contextGarmentsRail.removeFromChat') }}
            </button>
            <button
              v-else
              type="button"
              class="rounded bg-white/95 px-0.5 py-0.5 text-[8px] font-medium leading-tight text-red-900 shadow hover:bg-red-50"
              @click.stop="onRemoveStudio(e)"
            >
              {{ t('studio.chat.contextGarmentsRail.removeFromChat') }}
            </button>
          </div>
        </div>
        <div
          v-else-if="e.kind === 'loading'"
          class="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-pink-200 bg-white/80"
        >
          <Loader class="size-6 text-pink-400" />
        </div>
        <div
          v-else
          class="flex min-h-[3.5rem] w-full items-center justify-center rounded-lg border border-pink-100 bg-amber-50/90 px-1 py-2 text-center text-[9px] leading-tight text-amber-900"
        >
          {{ t('studio.chat.contextGarmentsRail.noCropHint') }}
        </div>
      </template>
    </aside>
  </template>
</template>
