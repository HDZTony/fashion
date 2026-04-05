/**
 * Studio chat: scene thumbnails order + effective try-on background (must match context rail).
 */
import {
  englishActionPromptForExampleImageUrl,
  isPersistableSceneImageUrl,
  normSceneBackgroundUrl,
  pickExampleBackgroundFromUserText,
} from '@/lib/studio-example-background-match'

export type StudioChatSceneContextMessage = {
  role: 'user' | 'assistant'
  text: string
  /** User message attachments (http preview URLs); used when text implies background + upload */
  imageUrls?: string[]
  sceneBackgroundUrl?: string
  sceneBackgroundActionPrompt?: string
}

/** User is talking about swapping / choosing a scene background (not generic try-on). */
function userMessageSuggestsSceneBackground(text: string): boolean {
  const s = text.trim()
  if (!s)
    return false
  return /背景|场景|换.*景|大海|沙滩|海边|海滩|beach|ocean|sea|background|scene|换成/i.test(s)
}

function persistableHttpImageUrls(urls: string[] | undefined): string[] {
  if (!urls?.length)
    return []
  const out: string[] = []
  for (const u of urls) {
    const t = (u || '').trim()
    if (isPersistableSceneImageUrl(t))
      out.push(t)
  }
  return out
}

/**
 * 无 Grok 返回的 scene_image_index、且本条未写 sceneBackgroundUrl 时的弱兜底（顺序不固定，仅作回退）。
 */
function sceneIntentAttachmentUrl(urls: string[] | undefined): string | null {
  const list = persistableHttpImageUrls(urls)
  if (list.length === 0)
    return null
  if (list.length >= 2)
    return list[list.length - 1]!
  return list[0]!
}

export type StudioChatSceneEntry = { url: string; actionPrompt: string }

/** Same dedupe / order as `StudioChatContextRail` scene strip (first occurrence wins per URL). */
export function buildStudioChatSceneContextEntries(
  messages: StudioChatSceneContextMessage[],
  excludedSceneBackgroundUrls: string[],
  chatPicked: { url: string; actionPrompt: string } | null,
): StudioChatSceneEntry[] {
  const excluded = new Set(excludedSceneBackgroundUrls.map(normSceneBackgroundUrl))
  const seen = new Set<string>()
  const out: StudioChatSceneEntry[] = []

  function push(urlRaw: string | undefined | null, actionPrompt: string) {
    const u = urlRaw?.trim()
    if (!u || !isPersistableSceneImageUrl(u))
      return
    const n = normSceneBackgroundUrl(u)
    if (excluded.has(n) || seen.has(n))
      return
    seen.add(n)
    out.push({ url: u, actionPrompt: actionPrompt.trim() })
  }

  for (const m of messages) {
    if (m.role !== 'user')
      continue
    if (m.sceneBackgroundUrl && isPersistableSceneImageUrl(m.sceneBackgroundUrl)) {
      const p =
        (m.sceneBackgroundActionPrompt ?? '').trim()
        || englishActionPromptForExampleImageUrl(m.sceneBackgroundUrl)
      push(m.sceneBackgroundUrl, p)
      continue
    }
    const auto = pickExampleBackgroundFromUserText(m.text)
    const bgIntent = userMessageSuggestsSceneBackground(m.text)
    const sceneAttach = sceneIntentAttachmentUrl(m.imageUrls)
    // 文案换场景 + 上传：多图时末张常为海景/环境；单图时即用户指定的自定义背景
    if (bgIntent && sceneAttach) {
      const p =
        (auto?.actionPrompt ?? '').trim()
        || englishActionPromptForExampleImageUrl(sceneAttach)
      push(sceneAttach, p)
      continue
    }
    if (auto)
      push(auto.url, auto.actionPrompt)
  }
  if (chatPicked?.url)
    push(chatPicked.url, chatPicked.actionPrompt ?? '')
  return out
}

/** Last visible scene in context = active background for ChatKit / try-on (replaces older picks). */
export function effectiveTryOnSceneFromContextEntries(
  entries: StudioChatSceneEntry[],
): StudioChatSceneEntry | null {
  if (entries.length === 0)
    return null
  return entries[entries.length - 1]!
}
