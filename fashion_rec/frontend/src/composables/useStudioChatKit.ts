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
import { resolveSceneBackgroundForChat } from '@/lib/studio-example-background-match'
import { API_URL } from '@/config/api'

export type StudioChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  imageUrls: string[]
  /** R2 / CDN try-on output URL parsed from assistant text; shown inline with copy button */
  resultImageUrl?: string
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
) {
  const authStore = useAuthStore()
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
  /** Left rail: Qwen intent crops keyed by user message id */
  const intentCropUrlsByMessageId = ref<Record<string, string[]>>({})
  const intentCropLoading = ref<Record<string, boolean>>({})
  const intentCropFailed = ref<Record<string, boolean>>({})

  let abort: AbortController | null = null

  function buildFetchHeaders(): Headers {
    const h = new Headers()
    h.set('Content-Type', 'application/json')
    const base = getOutfitPayload()
    let lastUserText = ''
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i]!.role === 'user') {
        lastUserText = messages.value[i]!.text.trim()
        break
      }
    }
    const excludedBg = getExcludedSceneBackgroundUrls?.() ?? []
    const resolvedBg = resolveSceneBackgroundForChat(
      lastUserText,
      {
        url: base.background_image_url,
        actionPrompt: base.background_action_prompt,
      },
      excludedBg,
    )
    const mergedBase: OutfitChatContextPayload = {
      ...base,
      background_image_url: resolvedBg?.url ?? undefined,
      background_action_prompt:
        resolvedBg?.url && resolvedBg.actionPrompt.trim()
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

  function buildUploadHeaders(): Headers {
    const h = new Headers()
    const token = authStore.accessToken
    if (token) h.set('Authorization', `Bearer ${token}`)
    return h
  }

  function newConversation() {
    abort?.abort()
    abort = null
    messages.value = []
    serverThreadId.value = null
    streamingText.value = ''
    streamError.value = null
    isStreaming.value = false
    intentCropUrlsByMessageId.value = {}
    intentCropLoading.value = {}
    intentCropFailed.value = {}
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
        const cropHeaders = new Headers()
        cropHeaders.set('Content-Type', 'application/json')
        if (authStore.accessToken)
          cropHeaders.set('Authorization', `Bearer ${authStore.accessToken}`)
        const cropBase = API_URL.replace(/\/$/, '')
        try {
          const res = await fetch(`${cropBase}/studio/intent-garment-crops`, {
            method: 'POST',
            headers: cropHeaders,
            body: JSON.stringify({
              image_urls: uploadedPreviewUrls,
              intent_text: intentForApi,
            }),
            signal,
          })
          if (!res.ok) {
            const txt = await res.text().catch(() => '')
            throw new Error(txt || `HTTP ${res.status}`)
          }
          const data = (await res.json()) as { crops?: { url: string }[] }
          const urls = (data.crops ?? []).map(c => c.url).filter(Boolean)
          intentCropUrlsByMessageId.value = {
            ...intentCropUrlsByMessageId.value,
            [uid]: urls,
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
      const body =
        serverThreadId.value === null
          ? buildThreadsCreateBody(input)
          : buildThreadsAddUserMessageBody(serverThreadId.value, input)

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
    sendUserMessage,
    resendUserMessage,
    stopGeneration,
  }
}
