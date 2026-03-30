/**
 * Direct client for fashion_rec FastAPI POST /chatkit (SSE) and POST /chatkit/upload.
 * Request/event shapes follow chatkit-python (pydantic model_dump_json by_alias=True).
 */

export interface ChatKitImageAttachment {
  type: 'image'
  id: string
  name: string
  mime_type: string
  preview_url: string
}

export function buildUserMessageInput(text: string, attachmentIds: string[]) {
  return {
    content: [{ type: 'input_text' as const, text }],
    attachments: attachmentIds,
    quoted_text: null,
    inference_options: { tool_choice: null, model: null },
  }
}

export function buildThreadsCreateBody(
  input: ReturnType<typeof buildUserMessageInput>,
  metadata: Record<string, unknown> = {},
) {
  return {
    metadata,
    type: 'threads.create' as const,
    params: { input },
  }
}

export function buildThreadsAddUserMessageBody(
  threadId: string,
  input: ReturnType<typeof buildUserMessageInput>,
  metadata: Record<string, unknown> = {},
) {
  return {
    metadata,
    type: 'threads.add_user_message' as const,
    params: { thread_id: threadId, input },
  }
}

function isImageAttachmentJson(data: unknown): data is ChatKitImageAttachment {
  if (typeof data !== 'object' || data === null) return false
  const o = data as Record<string, unknown>
  return (
    o.type === 'image' &&
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.mime_type === 'string' &&
    typeof o.preview_url === 'string'
  )
}

export async function uploadChatKitImage(
  file: File,
  uploadUrl: string,
  headers: HeadersInit | undefined,
): Promise<ChatKitImageAttachment> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  const res = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text.trim() || `HTTP ${res.status}`)
  }
  const data: unknown = await res.json()
  if (!isImageAttachmentJson(data)) {
    throw new Error('Invalid image attachment response')
  }
  return data
}

export type ChatKitStreamHandlers = {
  onThreadCreated?: (threadId: string) => void
  onTextDelta?: (delta: string) => void
  onErrorEvent?: (ev: { message?: string | null; allow_retry?: boolean }) => void
}

function processSseDataLine(data: string, handlers: ChatKitStreamHandlers) {
  if (!data) return
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return
  }
  if (!parsed || typeof parsed !== 'object') return
  const o = parsed as Record<string, unknown>
  switch (o.type) {
    case 'thread.created': {
      const thread = o.thread as Record<string, unknown> | undefined
      const id = thread && typeof thread.id === 'string' ? thread.id : null
      if (id) handlers.onThreadCreated?.(id)
      break
    }
    case 'thread.item.updated': {
      const upd = o.update as Record<string, unknown> | undefined
      if (
        upd?.type === 'assistant_message.content_part.text_delta' &&
        typeof upd.delta === 'string'
      ) {
        handlers.onTextDelta?.(upd.delta)
      }
      break
    }
    case 'error':
      handlers.onErrorEvent?.({
        message: typeof o.message === 'string' ? o.message : null,
        allow_retry: o.allow_retry === true,
      })
      break
    default:
      break
  }
}

/** Parse chatkit SSE: each event is `data: <json>\\n\\n` */
export async function consumeChatKitSse(
  body: ReadableStream<Uint8Array>,
  handlers: ChatKitStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel()
        throw new DOMException('Aborted', 'AbortError')
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const lines = raw.split('\n')
        let data = ''
        for (const line of lines) {
          if (line.startsWith('data:')) {
            data += line.slice(5).trimStart()
          }
        }
        processSseDataLine(data, handlers)
      }
    }
    const tail = buffer.trim()
    if (tail) {
      const lines = tail.split('\n')
      let data = ''
      for (const line of lines) {
        if (line.startsWith('data:')) {
          data += line.slice(5).trimStart()
        }
      }
      processSseDataLine(data, handlers)
    }
  } finally {
    reader.releaseLock()
  }
}

export async function postChatKitStream(
  apiUrl: string,
  body: object,
  init: { signal?: AbortSignal; headers?: HeadersInit },
  handlers: ChatKitStreamHandlers,
): Promise<void> {
  // Must use the Headers API: spreading a Headers instance into `{ ... }` drops all entries
  // (no enumerable keys), which previously stripped X-Fashion-Rec-Outfit-Context and broke
  // studio_try_on_garment_urls / try-on rail alignment.
  const merged = new Headers(init.headers ?? undefined)
  if (!merged.has('Content-Type'))
    merged.set('Content-Type', 'application/json')

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: merged,
    body: JSON.stringify(body),
    credentials: 'include',
    signal: init.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text.trim() || `HTTP ${res.status}`)
  }
  if (!res.body) throw new Error('No response body')
  await consumeChatKitSse(res.body, handlers, init.signal)
}
