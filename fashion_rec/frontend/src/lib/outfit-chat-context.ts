import { getChatKitApiUrl } from '@/lib/chatkit-config'

/**
 * Optional payload on each ChatKit request: when the Agents tool runs, the backend merges these fields like POST /outfit.
 * Does not trigger generation by itself—the orchestration model still chooses tool calls from the conversation.
 * Serialized as Base64URL JSON in `X-Fashion-Rec-Outfit-Context`.
 */
export interface OutfitChatContextPayload {
  base_item_ids?: string[]
  selected_items_roles?: Record<string, string>
  background_image_url?: string
  background_action_prompt?: string
  model_image_url?: string
  location?: string | null
  model?: 'qwen' | 'grok'
  /** R2 / crop URLs user removed in Studio chat rail; filtered out before POST /try-on */
  excluded_try_on_garment_urls?: string[]
  /**
   * Studio chat left rail: baseline thumbs + intent crops (order matches UI).
   * When set, ChatKit try-on prefers these over “latest message attachment only”.
   */
  studio_try_on_garment_urls?: string[]
}

function utf8JsonToBase64Url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const b64 = btoa(binary)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Compact JSON for `X-Fashion-Rec-Outfit-Context` (always includes `model`, default qwen).
 */
export function encodeOutfitContextHeader(payload: OutfitChatContextPayload): string {
  const body: Record<string, unknown> = {
    model: payload.model ?? 'qwen',
  }
  if (payload.base_item_ids?.length) body.base_item_ids = payload.base_item_ids
  if (payload.selected_items_roles && Object.keys(payload.selected_items_roles).length > 0) {
    body.selected_items_roles = payload.selected_items_roles
  }
  const bg = payload.background_image_url?.trim()
  if (bg) body.background_image_url = bg
  const bap = payload.background_action_prompt?.trim()
  if (bg && bap) body.background_action_prompt = bap
  const modelUrl = payload.model_image_url?.trim()
  if (modelUrl) body.model_image_url = modelUrl
  const loc = payload.location?.trim()
  if (loc) body.location = loc
  const ex = payload.excluded_try_on_garment_urls?.map((u) => u.trim()).filter(Boolean) ?? []
  if (ex.length > 0) body.excluded_try_on_garment_urls = ex.slice(0, 32)
  const rail = payload.studio_try_on_garment_urls?.map((u) => u.trim()).filter(Boolean) ?? []
  if (rail.length > 0) body.studio_try_on_garment_urls = rail.slice(0, 24)
  return utf8JsonToBase64Url(body)
}

export const OUTFIT_CTX_HEADER = 'x-fashion-rec-outfit-context'

/** Attach on ChatKit POST only (dev `/chatkit` or absolute API URL). */
export function isFashionRecChatKitPost(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (
    init?.method ??
    (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
  ).toUpperCase()
  if (method !== 'POST') return false

  const base = getChatKitApiUrl().replace(/\/$/, '')
  const fallbackOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const href =
    typeof input === 'string'
      ? new URL(input, fallbackOrigin).href
      : input instanceof URL
        ? input.href
        : input.url
  const reqUrl = new URL(href)

  if (base.startsWith('http://') || base.startsWith('https://')) {
    const b = new URL(base)
    const rp = reqUrl.pathname.replace(/\/$/, '') || '/'
    const bp = b.pathname.replace(/\/$/, '') || '/'
    return reqUrl.origin === b.origin && rp === bp
  }

  const p = reqUrl.pathname.replace(/\/$/, '') || '/'
  const exp = (base.startsWith('/') ? base : `/${base}`).replace(/\/$/, '') || '/'
  return p === exp
}
