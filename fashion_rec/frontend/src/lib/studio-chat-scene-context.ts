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

function firstPersistableHttpImageUrl(urls: string[] | undefined): string | null {
  if (!urls?.length)
    return null
  for (const u of urls) {
    const t = (u || '').trim()
    if (isPersistableSceneImageUrl(t))
      return t
  }
  return null
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
    const firstAttach = firstPersistableHttpImageUrl(m.imageUrls)
    // Prefer uploaded image when user asks for background change — matches LLM / try-on tool
    if (bgIntent && firstAttach) {
      const p =
        (auto?.actionPrompt ?? '').trim()
        || englishActionPromptForExampleImageUrl(firstAttach)
      push(firstAttach, p)
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
