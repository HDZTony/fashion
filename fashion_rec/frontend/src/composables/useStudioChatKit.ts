import { ref, type Ref } from 'vue'
import { nanoid } from 'nanoid'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'
import {
  buildThreadsAddUserMessageBody,
  buildThreadsCreateBody,
  buildUserMessageInput,
  postChatKitStream,
  uploadChatKitImage,
  type ChatKitImageAttachment,
} from '@/lib/chatkit-stream-client'
import { getChatKitApiUrl, getChatKitDirectUploadUrl } from '@/lib/chatkit-config'
import {
  encodeOutfitContextHeader,
  OUTFIT_CTX_HEADER,
  type OutfitChatContextPayload,
} from '@/lib/outfit-chat-context'
import type { AttachmentFile } from '@/components/ai-elements/prompt-input/types'
import { extractStudioResultImageUrl } from '@/lib/studio-chat-result-image'
import {
  englishActionPromptForExampleImageUrl,
  isPersistableSceneImageUrl,
  pickExampleBackgroundFromUserText,
} from '@/lib/studio-example-background-match'
import {
  buildStudioChatSceneContextEntries,
  effectiveTryOnSceneFromContextEntries,
} from '@/lib/studio-chat-scene-context'
import { API_URL } from '@/config/api'
import { apiClient } from '@/lib/api-client'
import { threadItemsJsonToStudioMessages } from '@/lib/chatkit-thread-to-messages'
import { MODEL_SCOPE_HEADER_KEY, MODEL_SCOPE_QUERY_KEY, resolveModelScopeId } from '@/lib/model-scope'

export type StudioChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  imageUrls: string[]
  /** R2 / CDN try-on output URL parsed from assistant text; shown inline with copy button */
  resultImageUrl?: string
  /** Scene background for this user turn (GET /chatkit/sessions/.../items metadata or set after send) */
  sceneBackgroundUrl?: string
  sceneBackgroundActionPrompt?: string
}

async function attachmentFileToFile(part: AttachmentFile): Promise<File | null> {
  if (part.file) return part.file
  const rawUrl = part.url?.trim() ?? ''
  if (rawUrl.startsWith('data:')) {
    try {
      const res = await fetch(rawUrl)
      const blob = await res.blob()
      const name = part.filename || 'image.png'
      return new File([blob], name, { type: part.mediaType || blob.type || 'image/png' })
    } catch {
      return null
    }
  }
  if (rawUrl.startsWith('blob:') || /^https?:\/\//i.test(rawUrl)) {
    try {
      const res = await fetch(rawUrl, { credentials: 'include' })
      if (!res.ok) return null
      const blob = await res.blob()
      const name = part.filename || 'image.jpg'
      return new File([blob], name, { type: part.mediaType || blob.type || 'image/jpeg' })
    } catch {
      return null
    }
  }
  return null
}

function normTryOnGarmentUrl(u: string): string {
  return u.trim().replace(/\/$/, '')
}

function userMessageHasHttpImage(m: StudioChatMessage): boolean {
  return m.imageUrls.some((u) => /^https?:\/\//i.test((u || '').trim()))
}

/**
 * Garment URLs for POST /try-on (header `studio_try_on_garment_urls`).
 * Align with StudioChatContextRail: wardrobe baseline, then per-message intent crops — not the raw
 * chat attachment previews when crops exist (those full frames were wrongly stitched as "garments").
 */
function collectStudioTryOnGarmentUrls(
  excludedList: string[],
  msgs: StudioChatMessage[],
  intentCropUrlsByMessageId: Record<string, string[]>,
  intentCropLoading: Record<string, boolean>,
  intentCropFailed: Record<string, boolean>,
): string[] {
  const excluded = new Set(excludedList.map(normTryOnGarmentUrl))
  const out: string[] = []
  const studioStore = useStudioStore()

  const anyChatUserImage = msgs.some(
    (m) => m.role === 'user' && userMessageHasHttpImage(m),
  )

  if (studioStore.activeWardrobeIds.length > 0) {
    for (const it of studioStore.activeWardrobeItems) {
      const url = it.url?.trim()
      if (url && !excluded.has(normTryOnGarmentUrl(url)))
        out.push(url)
    }
  }
  else if (
    !anyChatUserImage
    && studioStore.selectedItemIds.length > 0
    && studioStore.uploadedItems.length > 0
  ) {
    const ids = studioStore.selectedItemIds
      .map((id) => String(id))
      .filter((id) => studioStore.uploadedItems.some((x) => String(x.id) === id))
    for (const id of ids) {
      const it = studioStore.uploadedItems.find((x) => String(x.id) === id)
      const url = it?.url?.trim()
      if (url && !excluded.has(normTryOnGarmentUrl(url)))
        out.push(url)
    }
  }

  for (const m of msgs) {
    if (m.role !== 'user' || !userMessageHasHttpImage(m))
      continue
    const uid = m.id
    if (intentCropLoading[uid])
      continue

    function pushHttpAttachmentUrls() {
      for (const u of m.imageUrls) {
        const t = (u || '').trim()
        if (/^https?:\/\//i.test(t) && !excluded.has(normTryOnGarmentUrl(t)))
          out.push(t)
      }
    }

    if (intentCropFailed[uid]) {
      pushHttpAttachmentUrls()
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(intentCropUrlsByMessageId, uid))
      continue

    const crops = intentCropUrlsByMessageId[uid] ?? []
    if (crops.length > 0) {
      for (const u of crops) {
        const t = (u || '').trim()
        if (t && !excluded.has(normTryOnGarmentUrl(t)))
          out.push(t)
      }
    }
    else {
      pushHttpAttachmentUrls()
    }
  }

  const seen = new Set<string>()
  const deduped: string[] = []
  for (const u of out) {
    const n = normTryOnGarmentUrl(u)
    if (seen.has(n))
      continue
    seen.add(n)
    deduped.push(u.trim())
  }
  return deduped.slice(0, 24)
}

function isLlmConnectionFailureMessage(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false
  const s = raw.toLowerCase()
  return (
    s === 'chatkit error'
    || s.includes('connection error')
    || s.includes('connecterror')
    || s.includes('connect timeout')
    || s.includes('all connection attempts failed')
    || s.includes('apiconnectionerror')
    || s.includes('request timed out')
    || s.includes('timed out')
  )
}

function isAgentMaxTurnsMessage(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false
  const s = raw.toLowerCase()
  return s.includes('max turns') || s.includes('max_turns')
}

export function useStudioChatKit(
  getOutfitPayload: () => OutfitChatContextPayload,
  getExcludedSceneBackgroundUrls?: () => string[],
  getThreadCreateMetadata?: () => Record<string, unknown>,
  /** 弹窗/上传的当前示例背景；与 messages + excluded 一起决定侧栏与生成用的「最后一张」场景图 */
  getChatPickedSceneBackground?: () => { url: string; actionPrompt: string } | null,
) {
  const authStore = useAuthStore()
  const studioStore = useStudioStore()
  const { t } = useI18n()

  function mapStreamError(raw: string | null | undefined): string {
    if (isAgentMaxTurnsMessage(raw))
      return t('studio.chat.errors.agentMaxTurns')
    if (isLlmConnectionFailureMessage(raw))
      return t('studio.chat.errors.llmUnreachable')
    return (raw ?? '').trim() || t('studio.chat.errors.generic')
  }

  const messages: Ref<StudioChatMessage[]> = ref([])
  const serverThreadId = ref<string | null>(null)
  const streamingText = ref('')
  const isStreaming = ref(false)
  const streamError = ref<string | null>(null)
  /** Left rail: intent crops keyed by user message id */
  const intentCropUrlsByMessageId = ref<Record<string, string[]>>({})
  const intentCropLoading = ref<Record<string, boolean>>({})
  const intentCropFailed = ref<Record<string, boolean>>({})

  let abort: AbortController | null = null
  /** Aborts in-flight intent-crop hydration after restoreThread / fetchServerThread */
  let hydrateAbort: AbortController | null = null

  async function requestIntentGarmentCrops(
    imageUrls: string[],
    intentText: string,
    signal: AbortSignal,
  ): Promise<{ urls: string[]; sceneImageIndex: number | null }> {
    const cropHeaders = new Headers()
    cropHeaders.set('Content-Type', 'application/json')
    if (authStore.accessToken)
      cropHeaders.set('Authorization', `Bearer ${authStore.accessToken}`)
    const cropBase = API_URL.replace(/\/$/, '')
    const res = await fetch(`${cropBase}/studio/intent-garment-crops`, {
      method: 'POST',
      headers: cropHeaders,
      body: JSON.stringify({
        image_urls: imageUrls,
        intent_text: intentText,
      }),
      signal,
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(txt || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as {
      crops?: { url: string }[]
      scene_image_index?: number | null
    }
    const rawIdx = data.scene_image_index
    const sceneImageIndex =
      typeof rawIdx === 'number' && Number.isFinite(rawIdx)
        ? Math.trunc(rawIdx)
        : null
    return {
      urls: (data.crops ?? []).map(c => c.url).filter(Boolean),
      sceneImageIndex,
    }
  }

  async function hydrateIntentCropsForRestoredMessages(signal: AbortSignal) {
    const users = messages.value.filter(
      (m) => m.role === 'user' && userMessageHasHttpImage(m),
    )
    await Promise.all(users.map((m) => hydrateOneRestoredUserMessage(m, signal)))
  }

  async function hydrateOneRestoredUserMessage(m: StudioChatMessage, signal: AbortSignal) {
    const uid = m.id
    const https = m.imageUrls
      .map((u) => (u || '').trim())
      .filter((u) => /^https?:\/\//i.test(u))
    try {
      if (https.length === 0) {
        if (!signal.aborted) {
          intentCropUrlsByMessageId.value = {
            ...intentCropUrlsByMessageId.value,
            [uid]: [],
          }
        }
        return
      }
      const intentForApi =
        m.text.trim()
        || 'Identify clothing pieces in the image for virtual try-on (tops, bottoms, dress).'
      const { urls, sceneImageIndex } = await requestIntentGarmentCrops(https, intentForApi, signal)
      if (!signal.aborted) {
        intentCropUrlsByMessageId.value = {
          ...intentCropUrlsByMessageId.value,
          [uid]: urls,
        }
        if (
          sceneImageIndex != null
          && sceneImageIndex >= 0
          && sceneImageIndex < https.length
          && !m.sceneBackgroundUrl?.trim()
        ) {
          const su = https[sceneImageIndex]!.trim()
          if (isPersistableSceneImageUrl(su)) {
            m.sceneBackgroundUrl = su
            const auto = pickExampleBackgroundFromUserText(m.text.trim())
            const ap = (auto?.actionPrompt ?? '').trim() || englishActionPromptForExampleImageUrl(su)
            if (ap)
              m.sceneBackgroundActionPrompt = ap
          }
        }
      }
    }
    catch {
      if (!signal.aborted)
        intentCropFailed.value = { ...intentCropFailed.value, [uid]: true }
    }
    finally {
      if (!signal.aborted) {
        const next = { ...intentCropLoading.value }
        delete next[uid]
        intentCropLoading.value = next
      }
    }
  }

  /** 与侧栏「本对话上下文」场景条一致：取列表最后一项作为 ChatKit / 试穿有效背景 */
  function resolveTryOnSceneFromContext() {
    const excluded = getExcludedSceneBackgroundUrls?.() ?? []
    const picked = getChatPickedSceneBackground?.() ?? null
    const entries = buildStudioChatSceneContextEntries(messages.value, excluded, picked)
    return effectiveTryOnSceneFromContextEntries(entries)
  }

  function buildFetchHeaders(): Headers {
    const h = new Headers()
    h.set('Content-Type', 'application/json')
    h.set(MODEL_SCOPE_HEADER_KEY, resolveModelScopeId(studioStore.activeModelId))
    const base = getOutfitPayload()
    const resolvedBg = resolveTryOnSceneFromContext()
    const mergedBase: OutfitChatContextPayload = {
      ...base,
      background_image_url:
        resolvedBg?.url?.trim() && isPersistableSceneImageUrl(resolvedBg.url)
          ? resolvedBg.url.trim()
          : undefined,
      background_action_prompt:
        resolvedBg?.url?.trim()
        && isPersistableSceneImageUrl(resolvedBg.url)
        && resolvedBg.actionPrompt.trim()
          ? resolvedBg.actionPrompt.trim()
          : undefined,
    }
    const railUrls = collectStudioTryOnGarmentUrls(
      mergedBase.excluded_try_on_garment_urls ?? [],
      messages.value,
      intentCropUrlsByMessageId.value,
      intentCropLoading.value,
      intentCropFailed.value,
    )
    const payload: OutfitChatContextPayload = {
      ...mergedBase,
      studio_try_on_garment_urls: railUrls.length > 0 ? railUrls : undefined,
    }
    h.set(OUTFIT_CTX_HEADER, encodeOutfitContextHeader(payload))
    const token = authStore.accessToken
    if (token) h.set('Authorization', `Bearer ${token}`)
    return h
  }

  /** Same as outfit header; persisted on thread for restore */
  function buildTurnRequestMetadata(): Record<string, unknown> {
    const base = { ...(getThreadCreateMetadata?.() ?? {}) }
    const resolvedBg = resolveTryOnSceneFromContext()
    if (!resolvedBg?.url?.trim() || !isPersistableSceneImageUrl(resolvedBg.url))
      return base
    const out: Record<string, unknown> = {
      ...base,
      background_image_url: resolvedBg.url.trim(),
    }
    if (resolvedBg.actionPrompt.trim())
      out.background_action_prompt = resolvedBg.actionPrompt.trim()
    return out
  }

  function buildUploadHeaders(): Headers {
    const h = new Headers()
    h.set(MODEL_SCOPE_HEADER_KEY, resolveModelScopeId(studioStore.activeModelId))
    const token = authStore.accessToken
    if (token) h.set('Authorization', `Bearer ${token}`)
    return h
  }

  function newConversation() {
    abort?.abort()
    abort = null
    hydrateAbort?.abort()
    hydrateAbort = null
    messages.value = []
    serverThreadId.value = null
    streamingText.value = ''
    streamError.value = null
    isStreaming.value = false
    intentCropUrlsByMessageId.value = {}
    intentCropLoading.value = {}
    intentCropFailed.value = {}
  }

  /**
   * Restore UI messages; set nextServerThreadId to continue ChatKit/Agents/Grok on the same thread,
   * or null to start a new thread on next send.
   */
  function restoreThread(msgs: StudioChatMessage[], nextServerThreadId: string | null) {
    abort?.abort()
    abort = null
    hydrateAbort?.abort()
    hydrateAbort = new AbortController()
    const hydrateSignal = hydrateAbort.signal

    messages.value = msgs.map(m => ({
      ...m,
      imageUrls: [...m.imageUrls],
    }))
    serverThreadId.value = nextServerThreadId
    streamingText.value = ''
    streamError.value = null
    isStreaming.value = false
    intentCropUrlsByMessageId.value = {}
    intentCropFailed.value = {}

    const nextLoading: Record<string, boolean> = {}
    for (const m of messages.value) {
      if (m.role === 'user' && userMessageHasHttpImage(m))
        nextLoading[m.id] = true
    }
    intentCropLoading.value = nextLoading

    void hydrateIntentCropsForRestoredMessages(hydrateSignal)
  }

  /** Local-only snapshot: next message will use threads.create. */
  function restoreLocalSession(msgs: StudioChatMessage[]) {
    restoreThread(msgs, null)
  }

  /** Hydrate from GET /chatkit/sessions/{id}/items; next send uses threads.add_user_message. */
  async function fetchServerThread(threadId: string) {
    const { data } = await apiClient.get<{ items?: unknown[] }>(
      `/chatkit/sessions/${encodeURIComponent(threadId)}/items`,
      { params: { [MODEL_SCOPE_QUERY_KEY]: resolveModelScopeId(studioStore.activeModelId) } },
    )
    const msgs = threadItemsJsonToStudioMessages(data.items ?? []) as StudioChatMessage[]
    restoreThread(msgs, threadId)
  }

  async function sendUserMessage(text: string, attachmentParts: AttachmentFile[]) {
    const trimmed = text.trim()
    if (!trimmed && attachmentParts.length === 0) return

    streamError.value = null
    abort?.abort()
    abort = new AbortController()
    const signal = abort.signal

    const imageUrls = attachmentParts.map((p) => p.url).filter(Boolean)
    messages.value.push({
      id: nanoid(),
      role: 'user',
      text: trimmed,
      imageUrls,
    })

    isStreaming.value = true
    streamingText.value = ''
    let accumulatedAssistant = ''

    const uploadUrl = getChatKitDirectUploadUrl()
    const uploadHeaders = buildUploadHeaders()
    const attachmentIds: string[] = []
    const uploadedPreviewUrls: string[] = []

    let userAborted = false
    try {
      for (const part of attachmentParts) {
        const file = await attachmentFileToFile(part)
        if (!file) continue
        const att: ChatKitImageAttachment = await uploadChatKitImage(
          file,
          uploadUrl,
          uploadHeaders,
        )
        attachmentIds.push(att.id)
        uploadedPreviewUrls.push(att.preview_url)
      }

      let lastUser: StudioChatMessage | undefined
      for (let i = messages.value.length - 1; i >= 0; i--) {
        if (messages.value[i]!.role === 'user') {
          lastUser = messages.value[i]
          break
        }
      }
      if (lastUser && uploadedPreviewUrls.length > 0) {
        lastUser.imageUrls = uploadedPreviewUrls
        const uid = lastUser.id
        intentCropFailed.value = { ...intentCropFailed.value, [uid]: false }
        intentCropLoading.value = { ...intentCropLoading.value, [uid]: true }
        const intentForApi =
          trimmed
          || 'Identify clothing pieces in the image for virtual try-on (tops, bottoms, dress).'
        try {
          const { urls, sceneImageIndex } = await requestIntentGarmentCrops(
            uploadedPreviewUrls,
            intentForApi,
            signal,
          )
          intentCropUrlsByMessageId.value = {
            ...intentCropUrlsByMessageId.value,
            [uid]: urls,
          }
          if (
            sceneImageIndex != null
            && sceneImageIndex >= 0
            && sceneImageIndex < uploadedPreviewUrls.length
          ) {
            const su = uploadedPreviewUrls[sceneImageIndex]!.trim()
            if (isPersistableSceneImageUrl(su)) {
              lastUser.sceneBackgroundUrl = su
              const auto = pickExampleBackgroundFromUserText(trimmed)
              const ap = (auto?.actionPrompt ?? '').trim() || englishActionPromptForExampleImageUrl(su)
              if (ap)
                lastUser.sceneBackgroundActionPrompt = ap
            }
          }
        }
        catch {
          intentCropFailed.value = { ...intentCropFailed.value, [uid]: true }
        }
        finally {
          const next = { ...intentCropLoading.value }
          delete next[uid]
          intentCropLoading.value = next
        }
      }

      const input = buildUserMessageInput(trimmed || ' ', attachmentIds)
      const apiUrl = getChatKitApiUrl()
      const meta = buildTurnRequestMetadata()
      const body =
        serverThreadId.value === null
          ? buildThreadsCreateBody(input, meta)
          : buildThreadsAddUserMessageBody(serverThreadId.value, input, meta)

      await postChatKitStream(
        apiUrl,
        body,
        { signal, headers: buildFetchHeaders() },
        {
          onThreadCreated: (id) => {
            serverThreadId.value = id
          },
          onTextDelta: (delta) => {
            streamingText.value += delta
          },
          onErrorEvent: (ev) => {
            streamError.value = mapStreamError(ev.message)
          },
        },
      )

      const sceneAfterSend = resolveTryOnSceneFromContext()
      for (let i = messages.value.length - 1; i >= 0; i--) {
        const m = messages.value[i]!
        if (m.role !== 'user')
          continue
        if (sceneAfterSend?.url?.trim() && isPersistableSceneImageUrl(sceneAfterSend.url)) {
          m.sceneBackgroundUrl = sceneAfterSend.url.trim()
          m.sceneBackgroundActionPrompt = sceneAfterSend.actionPrompt.trim()
            ? sceneAfterSend.actionPrompt.trim()
            : undefined
        }
        break
      }

      accumulatedAssistant = streamingText.value
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        userAborted = true
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        streamError.value = msg ? mapStreamError(msg) : t('studio.chat.errors.generic')
      }
    } finally {
      const partialWhileStopping = streamingText.value
      isStreaming.value = false
      streamingText.value = ''
      abort = null
      if (userAborted)
        accumulatedAssistant = partialWhileStopping
    }

    if (accumulatedAssistant.trim().length > 0) {
      const resultImageUrl = extractStudioResultImageUrl(accumulatedAssistant) ?? undefined
      messages.value.push({
        id: nanoid(),
        role: 'assistant',
        text: accumulatedAssistant,
        imageUrls: [],
        resultImageUrl,
      })
    }
  }

  async function resendUserMessage(m: StudioChatMessage) {
    if (m.role !== 'user') return
    const trimmed = m.text.trim()
    if (!trimmed && m.imageUrls.length === 0) return
    const parts: AttachmentFile[] = m.imageUrls.map(url => ({
      id: nanoid(),
      type: 'file',
      url,
      mediaType: 'image/jpeg',
      filename: 'image.jpg',
    }))
    await sendUserMessage(trimmed, parts)
  }

  function stopGeneration() {
    abort?.abort()
  }

  return {
    messages,
    serverThreadId,
    streamingText,
    isStreaming,
    streamError,
    intentCropUrlsByMessageId,
    intentCropLoading,
    intentCropFailed,
    newConversation,
    restoreThread,
    restoreLocalSession,
    fetchServerThread,
    sendUserMessage,
    resendUserMessage,
    stopGeneration,
  }
}
