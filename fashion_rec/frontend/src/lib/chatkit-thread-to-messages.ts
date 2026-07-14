import { nanoid } from 'nanoid'
import { extractStudioResultImageUrl } from '@/lib/studio-chat-result-image'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function userMessageText(content: unknown): string {
  if (!Array.isArray(content))
    return ''
  const parts: string[] = []
  for (const c of content) {
    if (!isRecord(c))
      continue
    if (c.type === 'input_text' && typeof c.text === 'string')
      parts.push(c.text)
  }
  return parts.join('\n').trim()
}

function userMessageImageUrls(attachments: unknown): string[] {
  if (!Array.isArray(attachments))
    return []
  const out: string[] = []
  for (const a of attachments) {
    if (!isRecord(a))
      continue
    if (a.type === 'image' && typeof a.preview_url === 'string')
      out.push(a.preview_url)
  }
  return out
}

function assistantMessageText(content: unknown): string {
  if (!Array.isArray(content))
    return ''
  const parts: string[] = []
  for (const c of content) {
    if (!isRecord(c))
      continue
    if (c.type === 'output_text' && typeof c.text === 'string')
      parts.push(c.text)
  }
  return parts.join('')
}

/** Matches `StudioChatMessage` in useStudioChatKit (structural typing). */
export type ThreadMappedMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  imageUrls: string[]
  resultImageUrl?: string
  sceneBackgroundUrl?: string
  sceneBackgroundActionPrompt?: string
}

/**
 * Map GET /chatkit/sessions/{id}/items JSON to UI messages (user_message + assistant_message only).
 */
export function threadItemsJsonToStudioMessages(items: unknown[]): ThreadMappedMessage[] {
  const out: ThreadMappedMessage[] = []
  for (const raw of items) {
    if (!isRecord(raw))
      continue
    const id = typeof raw.id === 'string' ? raw.id : nanoid()
    const type = raw.type
    if (type === 'user_message') {
      const text = userMessageText(raw.content)
      const imageUrls = userMessageImageUrls(raw.attachments)
      let sceneBackgroundUrl: string | undefined
      let sceneBackgroundActionPrompt: string | undefined
      if (isRecord(raw.metadata)) {
        const u = raw.metadata.background_image_url
        const p = raw.metadata.background_action_prompt
        if (typeof u === 'string' && u.trim())
          sceneBackgroundUrl = u.trim()
        if (typeof p === 'string' && p.trim())
          sceneBackgroundActionPrompt = p.trim()
      }
      out.push({
        id,
        role: 'user',
        text,
        imageUrls,
        sceneBackgroundUrl,
        sceneBackgroundActionPrompt,
      })
    }
    else if (type === 'assistant_message') {
      const text = assistantMessageText(raw.content)
      const resultImageUrl = extractStudioResultImageUrl(text) ?? undefined
      out.push({
        id,
        role: 'assistant',
        text,
        imageUrls: [],
        resultImageUrl,
      })
    }
  }
  return out
}
