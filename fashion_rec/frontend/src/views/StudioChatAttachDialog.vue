<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import { useAuthStore } from '@/stores/auth'
import { apiClient } from '@/lib/api-client'
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

const COMPOSER_MAX_ATTACHMENTS = 5

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const { addFiles } = usePromptInput()

const wardrobeLoading = ref(false)
const wardrobeItems = ref<Array<{ id: string; url: string; label: string }>>([])
const selectedWardrobeIds = ref<string[]>([])
const attachError = ref<string | null>(null)
const attaching = ref(false)

function setOpen(v: boolean) {
  emit('update:open', v)
}

async function loadWardrobeItems() {
  if (!authStore.isAuthenticated) {
    wardrobeItems.value = []
    return
  }
  wardrobeLoading.value = true
  try {
    const { data } = await apiClient.get<{
      items: Array<{
        id: string
        path?: string
        url?: string
        type?: string
        color?: string
      }>
    }>('/items')
    wardrobeItems.value = (data.items || [])
      .map((it) => {
        const url = (it.path || it.url || '').trim()
        const label =
          [it.color, it.type].filter(Boolean).join(' · ') ||
          String(it.id).slice(0, 8)
        return { id: String(it.id), url, label }
      })
      .filter((it) => it.url.length > 0)
  } catch {
    wardrobeItems.value = []
  } finally {
    wardrobeLoading.value = false
  }
}

function toggleWardrobeSelect(id: string) {
  const cur = [...selectedWardrobeIds.value]
  const i = cur.indexOf(id)
  if (i >= 0) {
    selectedWardrobeIds.value = cur.filter((x) => x !== id)
  } else if (cur.length < COMPOSER_MAX_ATTACHMENTS) {
    selectedWardrobeIds.value = [...cur, id]
  }
}

function isWardrobeSelected(id: string) {
  return selectedWardrobeIds.value.includes(id)
}

async function attachWardrobeSelection() {
  if (!authStore.isAuthenticated || selectedWardrobeIds.value.length === 0) return
  attaching.value = true
  attachError.value = null
  try {
    const files: File[] = []
    for (const id of selectedWardrobeIds.value) {
      const res = await apiClient.get(`/items/${encodeURIComponent(id)}/image`, {
        responseType: 'blob',
      })
      const blob = res.data as Blob
      const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
      files.push(new File([blob], `wardrobe-${id}.${ext}`, { type: mime }))
    }
    addFiles(files)
    selectedWardrobeIds.value = []
    setOpen(false)
  } catch (e) {
    attachError.value =
      e instanceof Error ? e.message : t('studio.chat.wardrobePicker.attachFailed')
  } finally {
    attaching.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      selectedWardrobeIds.value = []
      attachError.value = null
      if (authStore.isAuthenticated) {
        void loadWardrobeItems()
      }
    } else {
      attachError.value = null
    }
  },
)
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent
      class="max-h-[85vh] gap-0 border-pink-100 p-0 sm:max-w-lg"
      :aria-describedby="undefined"
    >
      <DialogHeader class="border-b border-pink-100/80 px-4 py-3">
        <DialogTitle>{{ t('studio.chat.attachPanel.title') }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 px-4 py-3">
        <p v-if="attachError" class="text-sm text-amber-800">{{ attachError }}</p>

        <div
          v-if="!authStore.isAuthenticated"
          class="rounded-lg bg-muted/40 px-3 py-4 text-sm text-muted-foreground"
        >
          {{ t('studio.chat.wardrobePicker.loginRequired') }}
        </div>

        <div
          v-else-if="wardrobeLoading"
          class="py-10 text-center text-sm text-muted-foreground"
        >
          {{ t('common.loading') }}
        </div>

        <div
          v-else-if="wardrobeItems.length === 0"
          class="rounded-lg bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground"
        >
          {{ t('studio.chat.wardrobePicker.empty') }}
        </div>

        <ScrollArea v-else class="h-[min(42vh,320px)] pr-3">
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              v-for="it in wardrobeItems"
              :key="it.id"
              type="button"
              class="relative aspect-square overflow-hidden rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              :class="
                isWardrobeSelected(it.id)
                  ? 'border-pink-500 ring-2 ring-pink-200'
                  : 'border-transparent hover:border-pink-200'
              "
              :title="it.label"
              @click="toggleWardrobeSelect(it.id)"
            >
              <img
                :src="getThumbnailUrl(it.url)"
                :alt="it.label"
                class="size-full object-cover"
                loading="lazy"
              >
              <span
                v-if="isWardrobeSelected(it.id)"
                class="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-pink-600 text-xs font-bold text-white"
              >
                ✓
              </span>
            </button>
          </div>
        </ScrollArea>
      </div>

      <DialogFooter class="border-t border-pink-100/80 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          class="border-pink-200"
          @click="setOpen(false)"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          type="button"
          class="bg-pink-600 text-white hover:bg-pink-700"
          :disabled="
            !authStore.isAuthenticated ||
            selectedWardrobeIds.length === 0 ||
            attaching
          "
          @click="attachWardrobeSelection"
        >
          {{
            attaching
              ? t('common.loading')
              : t('studio.chat.wardrobePicker.addToComposer')
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
