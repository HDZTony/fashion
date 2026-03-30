<script setup lang="ts">
/**
 * Studio AI chat: Vue + AI Elements, POST /chatkit (SSE) and /chatkit/upload.
 * `X-Fashion-Rec-Outfit-Context` is sent on each /chatkit request (see useStudioChatKit).
 */
defineOptions({ name: 'StudioChat' })

import { computed, onMounted, ref, watch } from 'vue'
import type { Item } from '@/types'
import { useClipboard, useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { History, Image, Shirt, Trash2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import { useModelImages } from '@/composables/useModelImages'
import { useStudioChatKit, type StudioChatMessage } from '@/composables/useStudioChatKit'
import type { OutfitChatContextPayload } from '@/lib/outfit-chat-context'
import type { AttachmentFile, PromptInputMessage } from '@/components/ai-elements/prompt-input/types'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
import {
  isPersistableSceneImageUrl,
  pickExampleBackgroundFromUserText,
} from '@/lib/studio-example-background-match'
import {
  buildStudioChatSceneContextEntries,
  effectiveTryOnSceneFromContextEntries,
} from '@/lib/studio-chat-scene-context'
import { apiClient, uploadApiClient } from '@/lib/api-client'

type ServerChatSessionRow = {
  thread_id: string
  title: string
  created_at: string
}
import {
  cloneMessages,
  deleteHistoryEntry,
  deriveChatTitle,
  loadHistoryList,
  newChatSessionId,
  type StudioChatHistoryEntry,
  upsertHistoryEntry,
} from '@/lib/studio-chat-history'

const COMPOSER_MAX_ATTACHMENTS = 5
const COMPOSER_MAX_FILE_BYTES = 15 * 1024 * 1024

const { t, locale } = useI18n()
const authStore = useAuthStore()
const studioStore = useStudioStore()
const { modelImageUrlForChatContext, loadModels } = useModelImages()

const excludedTryOnGarmentUrls = ref<string[]>([])
const excludedSceneBackgroundUrls = ref<string[]>([])
/** 仅在本页「示例背景」弹窗点选；不向工作室 Outfit 全局背景回退 */
const chatPickedSceneBackground = ref<{ url: string; actionPrompt: string } | null>(null)
/** Full-screen preview for try-on result (click thumbnail). */
const tryOnLightboxUrl = ref<string | null>(null)
const railActionFeedback = ref<string | null>(null)
let railFeedbackTimer: ReturnType<typeof setTimeout> | null = null

/** Remount PromptInputProvider so composer clears on「新对话」/恢复历史 */
const composerResetKey = ref(0)
const historySheetOpen = ref(false)
const historyEntries = ref<StudioChatHistoryEntry[]>([])
const serverSessions = ref<ServerChatSessionRow[]>([])
const currentSessionId = ref(newChatSessionId())

const chatHistoryUserKey = computed(() => authStore.user?.id ?? 'anon')

async function refreshHistoryList() {
  if (authStore.isAuthenticated) {
    try {
      const { data } = await apiClient.get<{ threads?: ServerChatSessionRow[] }>(
        '/chatkit/sessions',
      )
      serverSessions.value = data.threads ?? []
    } catch {
      serverSessions.value = []
    }
  }
  else {
    serverSessions.value = []
  }
  historyEntries.value = loadHistoryList(chatHistoryUserKey.value)
}

function formatHistoryTime(ts: number): string {
  return new Date(ts).toLocaleString(
    locale.value === 'zh' ? 'zh-CN' : undefined,
    { dateStyle: 'short', timeStyle: 'short' },
  )
}

function formatServerSessionTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t))
    return iso
  return new Date(t).toLocaleString(
    locale.value === 'zh' ? 'zh-CN' : undefined,
    { dateStyle: 'short', timeStyle: 'short' },
  )
}

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

  return {
    model: studioStore.selectedModel,
    base_item_ids: baseItemIds,
    selected_items_roles: selectedItemsRoles,
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
  restoreLocalSession,
  fetchServerThread,
  sendUserMessage,
  resendUserMessage,
  stopGeneration,
} = useStudioChatKit(
  () => buildCurrentOutfitChatContext(),
  () => excludedSceneBackgroundUrls.value,
  () => ({ client: 'fashion-rec' }),
  () => chatPickedSceneBackground.value,
)

function persistCurrentSession() {
  if (authStore.isAuthenticated)
    return
  if (messages.value.length === 0)
    return
  upsertHistoryEntry(chatHistoryUserKey.value, {
    id: currentSessionId.value,
    updatedAt: Date.now(),
    title: deriveChatTitle(messages.value),
    messages: cloneMessages(messages.value),
  })
  refreshHistoryList()
}

const debouncedPersist = useDebounceFn(() => {
  if (isStreaming.value)
    return
  if (authStore.isAuthenticated)
    return
  persistCurrentSession()
}, 700)

watch(
  () => messages.value,
  () => {
    debouncedPersist()
  },
  { deep: true },
)

/** 新发的用户话里若命中示例场景关键词，则放弃弹窗/上传的「固定背景」，让对话里的场景参与上下文末尾（与侧栏一致） */
watch(
  () => messages.value.length,
  (len, prevLen) => {
    if (prevLen === undefined || len <= prevLen)
      return
    const last = messages.value[len - 1]
    if (last?.role !== 'user')
      return
    if (pickExampleBackgroundFromUserText(last.text.trim()))
      chatPickedSceneBackground.value = null
  },
)

watch(isStreaming, (streaming) => {
  if (!streaming)
    debouncedPersist()
})

watch(chatHistoryUserKey, () => {
  void refreshHistoryList()
})

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

/** 与 useStudioChatKit 里 resolveTryOnSceneFromContext 同源（侧栏展示 = 生成用的上下文序列） */
const studioChatSceneContextEntries = computed(() => {
  if (messages.value.length === 0)
    return []
  return buildStudioChatSceneContextEntries(
    messages.value,
    excludedSceneBackgroundUrls.value,
    chatPickedSceneBackground.value,
  )
})

/** 只展示当前有效场景缩略图，避免历史室内图与本轮大海同时出现 */
const contextSceneBackgroundUrls = computed(() => {
  const eff = effectiveTryOnSceneFromContextEntries(studioChatSceneContextEntries.value)
  return eff ? [eff.url] : []
})

/** 与 buildTurnRequestMetadata 一致：最后一条用户话的持久化场景 → 弹窗状态，便于恢复后继续对话 */
function syncChatPickedSceneFromLastUserMessage() {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i]!
    if (m.role !== 'user')
      continue
    if (m.sceneBackgroundUrl && isPersistableSceneImageUrl(m.sceneBackgroundUrl)) {
      chatPickedSceneBackground.value = {
        url: m.sceneBackgroundUrl.trim(),
        actionPrompt: (m.sceneBackgroundActionPrompt ?? '').trim(),
      }
    }
    else {
      chatPickedSceneBackground.value = null
    }
    return
  }
  chatPickedSceneBackground.value = null
}

function onChatBackgroundPicked(payload: { url: string; promptKey: string }) {
  chatPickedSceneBackground.value = {
    url: payload.url,
    actionPrompt: t(payload.promptKey),
  }
}

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
  void refreshHistoryList()
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
  if (isStreaming.value)
    stopGeneration()
  if (!authStore.isAuthenticated)
    persistCurrentSession()
  newConversation()
  currentSessionId.value = newChatSessionId()
  composerResetKey.value += 1
  promptFileError.value = null
  lastCopiedMessageId.value = null
  excludedTryOnGarmentUrls.value = []
  excludedSceneBackgroundUrls.value = []
  chatPickedSceneBackground.value = null
  railActionFeedback.value = null
  tryOnLightboxUrl.value = null
}

function openHistorySheet() {
  void refreshHistoryList()
  historySheetOpen.value = true
}

async function onSelectServerSession(row: ServerChatSessionRow) {
  if (isStreaming.value)
    stopGeneration()
  if (!authStore.isAuthenticated)
    return
  try {
    await fetchServerThread(row.thread_id)
    currentSessionId.value = row.thread_id
    composerResetKey.value += 1
    historySheetOpen.value = false
    promptFileError.value = null
    lastCopiedMessageId.value = null
    excludedTryOnGarmentUrls.value = []
    excludedSceneBackgroundUrls.value = []
    syncChatPickedSceneFromLastUserMessage()
    railActionFeedback.value = null
    tryOnLightboxUrl.value = null
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'response' in e
      ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? '')
      : ''
    streamError.value = msg || t('studio.chat.errors.generic')
  }
}

function onSelectHistoryEntry(entry: StudioChatHistoryEntry) {
  if (isStreaming.value)
    stopGeneration()
  if (!authStore.isAuthenticated)
    persistCurrentSession()
  restoreLocalSession(cloneMessages(entry.messages))
  currentSessionId.value = entry.id
  composerResetKey.value += 1
  historySheetOpen.value = false
  promptFileError.value = null
  lastCopiedMessageId.value = null
  excludedTryOnGarmentUrls.value = []
  excludedSceneBackgroundUrls.value = []
  syncChatPickedSceneFromLastUserMessage()
  railActionFeedback.value = null
  tryOnLightboxUrl.value = null
}

function onDeleteHistoryEntry(id: string) {
  deleteHistoryEntry(chatHistoryUserKey.value, id)
  refreshHistoryList()
  if (id === currentSessionId.value) {
    newConversation()
    currentSessionId.value = newChatSessionId()
    composerResetKey.value += 1
    promptFileError.value = null
    lastCopiedMessageId.value = null
    excludedTryOnGarmentUrls.value = []
    excludedSceneBackgroundUrls.value = []
    chatPickedSceneBackground.value = null
    railActionFeedback.value = null
    tryOnLightboxUrl.value = null
  }
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
      :key="composerResetKey"
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
          <div class="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="border-pink-200 text-pink-900 hover:bg-pink-50"
              @click="openHistorySheet"
            >
              <History class="mr-1 size-3.5 md:mr-1.5 md:size-4" />
              {{ t('studio.chat.chatHistory') }}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="border-pink-200 text-pink-900 hover:bg-pink-50"
              @click="onNewChat"
            >
              {{ t('studio.chat.newChat') }}
            </Button>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          <StudioChatContextRail
            :studio-thumbs="contextGarmentThumbs"
            :scene-background-urls="contextSceneBackgroundUrls"
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
        @picked="onChatBackgroundPicked"
      />

      <Sheet
        :open="historySheetOpen"
        @update:open="historySheetOpen = $event"
      >
        <SheetContent
          side="right"
          class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
        >
          <SheetHeader class="border-b border-pink-100 pb-4 text-left">
            <SheetTitle class="text-base text-pink-950">
              {{ t('studio.chat.chatHistoryTitle') }}
            </SheetTitle>
            <p class="text-xs text-muted-foreground">
              {{ t('studio.chat.chatHistoryHint') }}
            </p>
          </SheetHeader>
          <div class="min-h-0 flex-1 space-y-6 py-3">
            <div v-if="authStore.isAuthenticated">
              <p class="mb-2 px-1 text-xs font-medium text-muted-foreground">
                {{ t('studio.chat.chatHistoryServer') }}
              </p>
              <ul
                v-if="serverSessions.length > 0"
                class="space-y-2"
              >
                <li
                  v-for="s in serverSessions"
                  :key="s.thread_id"
                >
                  <button
                    type="button"
                    class="group flex w-full items-start gap-2 rounded-lg border border-pink-100/90 bg-pink-50/40 px-3 py-2.5 text-left text-sm transition hover:bg-pink-50"
                    @click="onSelectServerSession(s)"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="line-clamp-2 font-medium text-pink-950">
                        {{ s.title }}
                      </p>
                      <p class="mt-0.5 text-xs text-muted-foreground">
                        {{ formatServerSessionTime(s.created_at) }}
                      </p>
                    </div>
                  </button>
                </li>
              </ul>
              <p
                v-else-if="historyEntries.length > 0"
                class="px-1 text-sm text-muted-foreground"
              >
                {{ t('studio.chat.chatHistoryServerEmpty') }}
              </p>
            </div>

            <div v-if="historyEntries.length > 0">
              <p class="mb-2 px-1 text-xs font-medium text-muted-foreground">
                {{ t('studio.chat.chatHistoryLocal') }}
              </p>
              <ul class="space-y-2">
                <li
                  v-for="h in historyEntries"
                  :key="h.id"
                >
                  <button
                    type="button"
                    class="group flex w-full items-start gap-2 rounded-lg border border-pink-100/90 bg-pink-50/40 px-3 py-2.5 text-left text-sm transition hover:bg-pink-50"
                    @click="onSelectHistoryEntry(h)"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="line-clamp-2 font-medium text-pink-950">
                        {{ h.title }}
                      </p>
                      <p class="mt-0.5 text-xs text-muted-foreground">
                        {{ formatHistoryTime(h.updatedAt) }}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="shrink-0 h-8 w-8 text-muted-foreground hover:bg-pink-100 hover:text-pink-900"
                      :title="t('studio.chat.chatHistoryDelete')"
                      @click.stop="onDeleteHistoryEntry(h.id)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </button>
                </li>
              </ul>
            </div>

            <p
              v-if="(!authStore.isAuthenticated && historyEntries.length === 0) || (authStore.isAuthenticated && serverSessions.length === 0 && historyEntries.length === 0)"
              class="px-1 text-sm text-muted-foreground"
            >
              {{ t('studio.chat.chatHistoryEmpty') }}
            </p>
          </div>
        </SheetContent>
      </Sheet>

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
