<script setup lang="ts">
/**
 * Studio AI chat: Vue + AI Elements, POST /chatkit (SSE) and /chatkit/upload.
 * `X-Fashion-Rec-Outfit-Context` is sent on each /chatkit request (see useStudioChatKit).
 */
defineOptions({ name: 'StudioChat' })

import { computed, onMounted, ref } from 'vue'
import type { Item } from '@/types'
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { Image, Shirt } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import { useModelImages } from '@/composables/useModelImages'
import { useStudioChatKit, type StudioChatMessage } from '@/composables/useStudioChatKit'
import type { OutfitChatContextPayload } from '@/lib/outfit-chat-context'
import type { AttachmentFile, PromptInputMessage } from '@/components/ai-elements/prompt-input/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInputProvider,
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { Loader } from '@/components/ai-elements/loader'
import StudioChatAttachDialog from './StudioChatAttachDialog.vue'
import StudioChatBackgroundDialog from './StudioChatBackgroundDialog.vue'
import StudioChatContextRail from './StudioChatContextRail.vue'
import StudioChatPromptChips from './StudioChatPromptChips.vue'
import { stripStudioResultImageFromMarkdown } from '@/lib/studio-chat-result-image'
import { resolveSceneBackgroundForChat } from '@/lib/studio-example-background-match'
import { apiClient, uploadApiClient } from '@/lib/api-client'

const COMPOSER_MAX_ATTACHMENTS = 5
const COMPOSER_MAX_FILE_BYTES = 15 * 1024 * 1024

const { t } = useI18n()
const authStore = useAuthStore()
const studioStore = useStudioStore()
const { modelImageUrlForChatContext, loadModels } = useModelImages()

const excludedTryOnGarmentUrls = ref<string[]>([])
const excludedSceneBackgroundUrls = ref<string[]>([])
/** Full-screen preview for try-on result (click thumbnail). */
const tryOnLightboxUrl = ref<string | null>(null)
const railActionFeedback = ref<string | null>(null)
let railFeedbackTimer: ReturnType<typeof setTimeout> | null = null

function showRailFeedback(msg: string) {
  railActionFeedback.value = msg
  if (railFeedbackTimer)
    clearTimeout(railFeedbackTimer)
  railFeedbackTimer = setTimeout(() => {
    railActionFeedback.value = null
    railFeedbackTimer = null
  }, 2800)
}

function mapApiItemsToStore(
  raw: {
    id?: string | number
    path?: string
    type?: string
    color?: string
    style?: string
    pattern?: string
    occasion?: string
    material?: string
  }[],
): Item[] {
  return raw.map((item) => ({
    id: item.id,
    url: item.path,
    features: {
      path: item.path,
      type: item.type || 'Unknown',
      color: item.color || 'Unknown',
      style: item.style || 'Unknown',
      pattern: item.pattern,
      occasion: item.occasion,
      material: item.material,
    },
  }))
}

function buildCurrentOutfitChatContext(): OutfitChatContextPayload {
  let baseItemIds: string[] | undefined
  if (studioStore.activeWardrobeIds.length > 0) {
    baseItemIds = [...studioStore.activeWardrobeIds]
  } else if (studioStore.selectedItemIds.length > 0 && studioStore.uploadedItems.length > 0) {
    const ids = studioStore.selectedItemIds
      .map((id) => String(id))
      .filter((id) => studioStore.uploadedItems.some((it) => String(it.id) === id))
    if (ids.length > 0) baseItemIds = ids
  }

  const ex = excludedTryOnGarmentUrls.value.map((u) => u.trim()).filter(Boolean).slice(0, 32)

  let selectedItemsRoles: Record<string, string> | undefined
  if (studioStore.activeWardrobeIds.length > 0) {
    const map = studioStore.getActiveWardrobeRoleMap()
    const entries = Array.from(map.entries()).filter(([id]) =>
      studioStore.activeWardrobeIds.includes(String(id)),
    )
    if (entries.length > 0) {
      selectedItemsRoles = Object.fromEntries(
        entries.map(([id, role]) => [String(id), role]),
      )
    }
  }

  const bg = studioStore.backgroundImageUrl?.trim()
  const bap = studioStore.backgroundActionPrompt?.trim()

  return {
    model: studioStore.selectedModel,
    base_item_ids: baseItemIds,
    selected_items_roles: selectedItemsRoles,
    background_image_url: bg || undefined,
    background_action_prompt: bg && bap ? bap : undefined,
    model_image_url: modelImageUrlForChatContext.value.trim(),
    excluded_try_on_garment_urls: ex.length > 0 ? ex : undefined,
  }
}

const {
  messages,
  streamingText,
  isStreaming,
  streamError,
  intentCropUrlsByMessageId,
  intentCropLoading,
  intentCropFailed,
  newConversation,
  sendUserMessage,
  resendUserMessage,
  stopGeneration,
} = useStudioChatKit(
  () => buildCurrentOutfitChatContext(),
  () => excludedSceneBackgroundUrls.value,
)

/** Thumbnails for base items sent in X-Fashion-Rec-Outfit-Context (same logic as buildCurrentOutfitChatContext). */
const contextGarmentThumbs = computed(() => {
  const out: { key: string; url: string; itemId: string; source: 'wardrobe' | 'selected' }[] = []
  if (studioStore.activeWardrobeIds.length > 0) {
    for (const it of studioStore.activeWardrobeItems) {
      const url = it.url?.trim()
      const id = String(it.id ?? '')
      if (url && id)
        out.push({ key: `wardrobe-${id}`, url, itemId: id, source: 'wardrobe' })
    }
    return out
  }
  if (studioStore.selectedItemIds.length > 0 && studioStore.uploadedItems.length > 0) {
    const ids = studioStore.selectedItemIds
      .map((id) => String(id))
      .filter((id) => studioStore.uploadedItems.some((x) => String(x.id) === id))
    for (const id of ids) {
      const it = studioStore.uploadedItems.find((x) => String(x.id) === id)
      const url = it?.url?.trim()
      if (it && url)
        out.push({ key: `selected-${id}`, url, itemId: id, source: 'selected' })
    }
  }
  return out
})

/** Scene background for left rail — same as useStudioChatKit / resolveSceneBackgroundForChat. */
/** 与基准单品一致：无对话消息时不展示场景缩略图；发消息后按文案/工作室设置解析 */
const contextSceneBackgroundUrl = computed(() => {
  if (messages.value.length === 0)
    return null
  let lastUserText = ''
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i]!.role === 'user') {
      lastUserText = messages.value[i]!.text.trim()
      break
    }
  }
  return (
    resolveSceneBackgroundForChat(
      lastUserText,
      {
        url: studioStore.backgroundImageUrl,
        actionPrompt: studioStore.backgroundActionPrompt,
      },
      excludedSceneBackgroundUrls.value,
    )?.url ?? null
  )
})

/** Last user message in thread — pause/stop sits beside its resend button while assistant streams. */
const lastUserMessageId = computed(() => {
  const list = messages.value
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]!.role === 'user')
      return list[i]!.id
  }
  return null
})

const attachPanelOpen = ref(false)
const backgroundPanelOpen = ref(false)
const promptFileError = ref<string | null>(null)

const { copy, isSupported } = useClipboard({ legacy: true })
const lastCopiedMessageId = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

function assistantMarkdownForDisplay(m: StudioChatMessage): string {
  if (m.role !== 'assistant' || !m.resultImageUrl)
    return m.text
  return stripStudioResultImageFromMarkdown(m.text, m.resultImageUrl)
}

async function copyTryOnResultLink(messageId: string, url: string) {
  if (!url) return
  try {
    if (isSupported.value)
      await copy(url)
    else
      await navigator.clipboard.writeText(url)
    lastCopiedMessageId.value = messageId
    if (copyFeedbackTimer)
      clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = setTimeout(() => {
      lastCopiedMessageId.value = null
      copyFeedbackTimer = null
    }, 2500)
  } catch {
    window.alert(t('studio.chat.tryOnInline.copyFailed'))
  }
}

onMounted(() => {
  const bg = studioStore.backgroundImageUrl
  if (bg?.startsWith('blob:')) {
    studioStore.setBackgroundImage(null, null)
    studioStore.setBackgroundActionPrompt('')
  }
  if (authStore.isAuthenticated) {
    void loadModels()
  }
})

async function onPromptSubmit(msg: PromptInputMessage) {
  promptFileError.value = null
  await sendUserMessage(msg.text, msg.files as AttachmentFile[])
}

function onPromptError(err: { code: string; message: string }) {
  if (err.code === 'max_file_size') {
    promptFileError.value = t('studio.chat.attachPanel.fileTooLarge')
  } else {
    promptFileError.value = err.message
  }
}

function dismissStreamError() {
  streamError.value = null
}

function openTryOnLightbox(url: string) {
  const u = url.trim()
  if (u)
    tryOnLightboxUrl.value = u
}

function onTryOnLightboxOpen(open: boolean) {
  if (!open)
    tryOnLightboxUrl.value = null
}

function onNewChat() {
  newConversation()
  promptFileError.value = null
  lastCopiedMessageId.value = null
  excludedTryOnGarmentUrls.value = []
  excludedSceneBackgroundUrls.value = []
  railActionFeedback.value = null
  tryOnLightboxUrl.value = null
}

function normGarmentUrlForExclusion(u: string): string {
  return u.trim().replace(/\/$/, '')
}

function onRailExcludeTryOnUrl(url: string) {
  const n = normGarmentUrlForExclusion(url)
  if (!n)
    return
  if (excludedTryOnGarmentUrls.value.some((x) => normGarmentUrlForExclusion(x) === n))
    return
  excludedTryOnGarmentUrls.value = [...excludedTryOnGarmentUrls.value, url.trim()]
  showRailFeedback(t('studio.chat.contextGarmentsRail.feedbackRemovedFromTryOn'))
}

function onRailExcludeSceneBackground(url: string) {
  const n = normGarmentUrlForExclusion(url)
  if (!n)
    return
  if (excludedSceneBackgroundUrls.value.some((x) => normGarmentUrlForExclusion(x) === n))
    return
  excludedSceneBackgroundUrls.value = [...excludedSceneBackgroundUrls.value, url.trim()]
  showRailFeedback(t('studio.chat.contextGarmentsRail.feedbackRemovedSceneBackground'))
}

function onRailRemoveStudioItem(payload: { itemId: string; source: 'wardrobe' | 'selected' }) {
  if (payload.source === 'wardrobe') {
    studioStore.removeActiveWardrobeId(payload.itemId)
    const m = studioStore.getActiveWardrobeRoleMap()
    m.delete(payload.itemId)
    studioStore.setActiveWardrobeRoleMap(m)
  }
  else {
    studioStore.removeSelectedItemId(payload.itemId)
  }
  showRailFeedback(t('studio.chat.contextGarmentsRail.feedbackRemovedBaseline'))
}

async function onRailAddToWardrobe(url: string) {
  if (!authStore.isAuthenticated) {
    showRailFeedback(t('studio.chat.contextGarmentsRail.feedbackLoginRequired'))
    return
  }
  const u = url.trim()
  if (!u)
    return
  try {
    await uploadApiClient.post<{ items: Item[] }>('/items/batch', [
      {
        url: u,
        features: {
          type: 'Other',
          color: 'Unknown',
          gender: 'Unisex',
          description: 'Studio chat',
        },
      },
    ])
    const refreshed = await apiClient.get<{
      items: {
        id?: string | number
        path?: string
        type?: string
        color?: string
        style?: string
        pattern?: string
        occasion?: string
        material?: string
      }[]
    }>('/items')
    studioStore.setUploadedItems(mapApiItemsToStore(refreshed.data.items))
    showRailFeedback(t('studio.chat.contextGarmentsRail.feedbackAddedToWardrobe'))
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e
        ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
        : ''
    showRailFeedback(msg || t('studio.chat.contextGarmentsRail.feedbackAddFailed'))
  }
}
</script>

<template>
  <div class="relative min-h-0 flex-1 px-2 pb-3 pt-2 md:px-4">
    <PromptInputProvider
      :max-files="COMPOSER_MAX_ATTACHMENTS"
      :max-file-size="COMPOSER_MAX_FILE_BYTES"
      accept="image/*"
      @submit="onPromptSubmit"
      @error="onPromptError"
    >
      <div
        class="relative flex h-[calc(100vh-5.5rem)] min-h-[480px] w-full flex-col overflow-hidden rounded-xl border border-pink-100 bg-white shadow-sm"
      >
        <p
          v-if="railActionFeedback"
          class="pointer-events-none absolute left-1/2 top-12 z-20 max-w-[min(90%,20rem)] -translate-x-1/2 rounded-md bg-pink-950/90 px-2.5 py-1.5 text-center text-[11px] leading-snug text-white shadow-md"
          role="status"
        >
          {{ railActionFeedback }}
        </p>
        <div
          class="flex shrink-0 items-center justify-between gap-2 border-b border-pink-100/80 px-3 py-2 md:px-4"
        >
          <h2 class="text-sm font-semibold text-pink-950 md:text-base">
            {{ t('studio.chat.title') }}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="border-pink-200 text-pink-900 hover:bg-pink-50"
            :disabled="isStreaming"
            @click="onNewChat"
          >
            {{ t('studio.chat.newChat') }}
          </Button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          <StudioChatContextRail
            :studio-thumbs="contextGarmentThumbs"
            :scene-background-url="contextSceneBackgroundUrl"
            :messages="messages"
            :intent-crop-urls-by-message-id="intentCropUrlsByMessageId"
            :intent-crop-loading="intentCropLoading"
            :intent-crop-failed="intentCropFailed"
            :excluded-try-on-garment-urls="excludedTryOnGarmentUrls"
            @add-to-wardrobe="onRailAddToWardrobe"
            @exclude-try-on-url="onRailExcludeTryOnUrl"
            @exclude-scene-background="onRailExcludeSceneBackground"
            @remove-studio-item="onRailRemoveStudioItem"
          />

          <Conversation class="min-h-0 min-w-0 flex-1">
            <ConversationContent>
            <ConversationEmptyState
              v-if="messages.length === 0 && !isStreaming"
              :title="t('studio.chat.emptyTitle')"
              :description="t('studio.chat.hint')"
            />

            <Message
              v-for="m in messages"
              :key="m.id"
              :from="m.role"
            >
              <MessageContent>
                <div
                  v-if="m.imageUrls.length > 0"
                  class="mb-2 flex flex-wrap gap-1"
                >
                  <img
                    v-for="(src, i) in m.imageUrls"
                    :key="i"
                    :src="src"
                    alt=""
                    class="max-h-24 max-w-[120px] rounded-md object-cover"
                  >
                </div>

                <template v-if="m.role === 'assistant'">
                  <div
                    v-if="m.resultImageUrl"
                    class="mb-3 space-y-2"
                  >
                    <button
                      type="button"
                      class="group block max-w-full rounded-lg border border-pink-100/90 p-0 text-left shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                      :aria-label="t('studio.chat.tryOnInline.openEnlarged')"
                      @click="openTryOnLightbox(m.resultImageUrl!)"
                    >
                      <img
                        :src="m.resultImageUrl"
                        :alt="t('studio.chat.tryOnInline.imageAlt')"
                        class="max-h-[min(360px,55vh)] max-w-full cursor-zoom-in rounded-lg object-contain"
                        loading="lazy"
                        decoding="async"
                      >
                    </button>
                    <p class="text-xs text-muted-foreground italic">
                      {{ t('studio.chat.tryOnInline.caption') }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      <a
                        :href="m.resultImageUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-pink-800 underline underline-offset-2 hover:text-pink-950"
                      >
                        {{ t('studio.chat.tryOnInline.openInNewTab') }}
                      </a>
                    </p>
                    <div class="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="border-pink-200 text-pink-900 hover:bg-pink-50"
                        @click="copyTryOnResultLink(m.id, m.resultImageUrl!)"
                      >
                        {{ t('studio.chat.tryOnInline.copyLink') }}
                      </Button>
                      <span
                        v-if="lastCopiedMessageId === m.id"
                        class="text-xs text-pink-800"
                      >
                        {{ t('studio.chat.tryOnInline.linkCopied') }}
                      </span>
                    </div>
                  </div>
                  <MessageResponse
                    :content="assistantMarkdownForDisplay(m)"
                  />
                </template>
                <template v-else>
                  <p
                    v-if="m.text.trim().length > 0"
                    class="whitespace-pre-wrap"
                  >
                    {{ m.text }}
                  </p>
                  <div class="flex flex-wrap justify-end gap-2">
                    <Button
                      v-if="isStreaming && m.id === lastUserMessageId"
                      type="button"
                      variant="outline"
                      size="sm"
                      class="border-pink-200 text-pink-900 hover:bg-pink-50"
                      @click="stopGeneration"
                    >
                      {{ t('studio.chat.pauseGeneration') }}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      class="border-pink-200/80 text-pink-900 hover:bg-pink-50"
                      :disabled="isStreaming"
                      @click="resendUserMessage(m)"
                    >
                      {{ t('studio.chat.resend') }}
                    </Button>
                  </div>
                </template>
              </MessageContent>
            </Message>

            <Message
              v-if="isStreaming || streamingText.length > 0"
              from="assistant"
            >
              <MessageContent>
                <div
                  v-if="isStreaming && !streamingText"
                  class="mb-2 flex items-center gap-2 text-muted-foreground"
                >
                  <Loader class="size-4" />
                  <span class="text-sm">{{ t('studio.chat.thinking') }}</span>
                </div>
                <p
                  v-else-if="isStreaming && streamingText"
                  class="mb-1 text-xs text-muted-foreground"
                >
                  {{ t('studio.chat.streamingReply') }}
                </p>
                <MessageResponse
                  v-if="streamingText"
                  :content="streamingText"
                />
              </MessageContent>
            </Message>
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>

        <div class="shrink-0 border-t border-pink-100/80 p-2 md:p-3">
          <p
            v-if="streamError"
            class="mb-2 flex items-start justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            <span>{{ streamError }}</span>
            <button
              type="button"
              class="shrink-0 underline"
              @click="dismissStreamError"
            >
              {{ t('studio.chat.dismissError') }}
            </button>
          </p>
          <p
            v-if="promptFileError"
            class="mb-2 text-sm text-amber-800"
          >
            {{ promptFileError }}
          </p>

          <PromptInput
            accept="image/*"
            multiple
            class="border border-pink-200 rounded-xl bg-white transition-all focus-within:border-pink-400 focus-within:shadow-md min-h-[100px] flex flex-col"
          >
            <PromptInputHeader>
              <StudioChatPromptChips />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                :placeholder="t('studio.chat.inputPlaceholder')"
                class="min-h-[72px] px-4 py-3 text-sm placeholder:text-pink-600/70"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments :label="t('studio.chat.attachPanel.uploadLocal')" />
                    <PromptInputActionMenuItem @select.prevent="attachPanelOpen = true">
                      <Shirt class="mr-2 size-4" />
                      {{ t('studio.chat.attachPanel.toolLabel') }}
                    </PromptInputActionMenuItem>
                    <PromptInputActionMenuItem @select.prevent="backgroundPanelOpen = true">
                      <Image class="mr-2 size-4" />
                      {{ t('studio.chat.attachPanel.addBackground') }}
                    </PromptInputActionMenuItem>
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
              </PromptInputTools>
              <PromptInputSubmit
                :disabled="isStreaming"
                :status="isStreaming ? 'submitted' : 'ready'"
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

      <StudioChatAttachDialog
        :open="attachPanelOpen"
        @update:open="attachPanelOpen = $event"
      />
      <StudioChatBackgroundDialog
        :open="backgroundPanelOpen"
        @update:open="backgroundPanelOpen = $event"
      />

      <Dialog
        :open="tryOnLightboxUrl !== null"
        @update:open="onTryOnLightboxOpen"
      >
        <DialogContent class="max-w-[min(96vw,56rem)] border-pink-100">
          <DialogHeader>
            <DialogTitle class="sr-only">
              {{ t('studio.chat.tryOnInline.lightboxTitle') }}
            </DialogTitle>
          </DialogHeader>
          <img
            v-if="tryOnLightboxUrl"
            :src="tryOnLightboxUrl"
            :alt="t('studio.chat.tryOnInline.imageAlt')"
            class="max-h-[min(85vh,900px)] w-full object-contain"
          >
          <DialogFooter class="sm:justify-center">
            <Button
              v-if="tryOnLightboxUrl"
              as="a"
              variant="outline"
              class="border-pink-200 text-pink-900 hover:bg-pink-50"
              :href="tryOnLightboxUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t('studio.chat.tryOnInline.openInNewTab') }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PromptInputProvider>
  </div>
</template>
