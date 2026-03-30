<script setup lang="ts">
/**
 * Pick an example scene background for outfit / try-on context (same R2 samples as Studio).
 */
import { useI18n } from 'vue-i18n'
import { useStudioStore } from '@/stores/studio'
import { EXAMPLE_BACKGROUND_IMAGES } from '@/lib/studio-example-backgrounds'
import { getThumbnailUrl } from '@/lib/imageOptimizer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'picked', payload: { url: string; promptKey: string }): void
}>()

const { t } = useI18n()
const studioStore = useStudioStore()

function setOpen(v: boolean) {
  emit('update:open', v)
}

function selectBackground(url: string, promptKey: string) {
  studioStore.setBackgroundImage(url, url)
  studioStore.setBackgroundActionPrompt(t(promptKey))
  emit('picked', { url, promptKey })
  setOpen(false)
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent
      class="max-h-[85vh] gap-0 border-pink-100 p-0 sm:max-w-lg"
      :aria-describedby="undefined"
    >
      <DialogHeader class="border-b border-pink-100/80 px-4 py-3">
        <DialogTitle>{{ t('studio.chat.attachPanel.exampleBackgroundsTitle') }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 px-4 py-3">
        <p class="text-sm text-muted-foreground">
          {{ t('studio.chat.attachPanel.exampleBackgroundsHint') }}
        </p>

        <ScrollArea class="h-[min(48vh,380px)] pr-3">
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              v-for="(ex, idx) in EXAMPLE_BACKGROUND_IMAGES"
              :key="idx"
              type="button"
              class="relative aspect-square overflow-hidden rounded-lg border-2 border-transparent transition hover:border-pink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              :title="t(ex.prompt)"
              @click="selectBackground(ex.url, ex.prompt)"
            >
              <img
                :src="getThumbnailUrl(ex.url)"
                alt=""
                class="size-full object-cover"
                loading="lazy"
              >
            </button>
          </div>
        </ScrollArea>
      </div>

      <DialogFooter class="border-t border-pink-100/80 px-4 py-3 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          class="border-pink-200"
          @click="setOpen(false)"
        >
          {{ t('common.cancel') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
