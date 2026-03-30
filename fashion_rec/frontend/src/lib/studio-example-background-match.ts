/**
 * Pick an example scene background URL + action prompt for Qwen image 3 from free-text user input.
 * Uses token overlap against merged en/zh `studio.exampleBackgroundPrompts` copy from shared i18n.
 */
import { messages } from '@fashion-rec/shared'
import { EXAMPLE_BACKGROUND_IMAGES } from '@/lib/studio-example-backgrounds'

const STOP = new Set([
  'model',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'like',
  'are',
  'was',
  'has',
  'have',
  'been',
  'being',
  '模特',
  '的',
  '在',
  '和',
  '与',
  '是',
  '了',
  '着',
  '中',
  '对',
  '将',
  '把',
  '一个',
  '做出',
])

function promptKeyFromEntry(promptKey: string): string {
  const m = promptKey.match(/(\d{3})$/)
  return m?.[1] ?? '001'
}

function mergedLocalePrompt(key: string): string {
  const en = messages.en.studio.exampleBackgroundPrompts[key as keyof typeof messages.en.studio.exampleBackgroundPrompts]
  const zh = messages.zh.studio.exampleBackgroundPrompts[key as keyof typeof messages.zh.studio.exampleBackgroundPrompts]
  return `${en ?? ''} ${zh ?? ''}`
}

function tokenize(text: string): Set<string> {
  const out = new Set<string>()
  const lower = text.toLowerCase()
  for (const w of lower.match(/[a-z]{3,}/g) ?? []) {
    if (!STOP.has(w))
      out.add(w)
  }
  for (const seg of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (seg.length >= 2) {
      for (let i = 0; i <= seg.length - 2; i++) {
        const bi = seg.slice(i, i + 2)
        if (!STOP.has(bi))
          out.add(bi)
      }
    }
    else {
      out.add(seg)
    }
  }
  return out
}

/** English action line for API / Qwen prompt (stable regardless of UI locale). */
function englishActionPrompt(key: string): string {
  const en = messages.en.studio.exampleBackgroundPrompts[key as keyof typeof messages.en.studio.exampleBackgroundPrompts]
  return (en ?? '').trim()
}

/**
 * Returns the best-matching example background if user text overlaps scene keywords
 * (bilingual), else `null` so callers can fall back to studio store / no background.
 */
export function pickExampleBackgroundFromUserText(userText: string): {
  url: string
  actionPrompt: string
} | null {
  const trimmed = userText.trim()
  if (!trimmed)
    return null

  const userTok = tokenize(trimmed)
  if (userTok.size === 0)
    return null

  const scores: { i: number; score: number }[] = []
  for (let i = 0; i < EXAMPLE_BACKGROUND_IMAGES.length; i++) {
    const key = promptKeyFromEntry(EXAMPLE_BACKGROUND_IMAGES[i]!.prompt)
    const promptTok = tokenize(mergedLocalePrompt(key))
    let score = 0
    for (const tok of userTok) {
      if (promptTok.has(tok))
        score++
    }
    scores.push({ i, score })
  }

  scores.sort((a, b) => b.score - a.score || a.i - b.i)
  const max = scores[0]?.score ?? 0
  if (max < 1)
    return null

  const tied = scores.filter(s => s.score === max)
  const chosen = tied.sort((a, b) => a.i - b.i)[0]!

  const ex = EXAMPLE_BACKGROUND_IMAGES[chosen.i]!
  const key = promptKeyFromEntry(ex.prompt)
  const action = englishActionPrompt(key)
  if (!action)
    return null

  return { url: ex.url, actionPrompt: action }
}

/** Same normalization as garment URL exclusion in Studio chat. */
export function normSceneBackgroundUrl(u: string): string {
  return (u || '').trim().replace(/\/$/, '')
}

/** English Qwen action line for a known example image URL (persisted turns may omit prompt text). */
export function englishActionPromptForExampleImageUrl(url: string): string {
  const n = normSceneBackgroundUrl(url)
  if (!n)
    return ''
  for (const ex of EXAMPLE_BACKGROUND_IMAGES) {
    if (normSceneBackgroundUrl(ex.url) !== n)
      continue
    return englishActionPrompt(promptKeyFromEntry(ex.prompt))
  }
  return ''
}

/**
 * Only http(s) URLs are valid after reload. Blob URLs are session-only; Pinia persist can
 * restore a blob string that no longer resolves, which would show an empty rail thumbnail.
 */
export function isPersistableSceneImageUrl(url: string): boolean {
  const u = url.trim()
  if (!u || u.startsWith('blob:'))
    return false
  return /^https?:\/\//i.test(u)
}

/**
 * Effective scene for rail + ChatKit:
 * 1) Explicit pick from **this chat** only (`explicitChat`, e.g. 示例背景弹窗) — **优先**，避免恢复历史后
 *    旧消息里的场景关键词仍自动匹配、覆盖用户刚选的示例图。
 * 2) Else `pickExampleBackgroundFromUserText(lastUserText)`（文案自动匹配）
 * Does **not** inherit 工作室 Outfit Generator global `studioStore` background.
 * Returns null if the chosen URL is in `excludedUrls` (session “remove”).
 */
export function resolveSceneBackgroundForChat(
  lastUserText: string,
  explicitChat: { url?: string | null; actionPrompt?: string | null } | null,
  excludedUrls: string[],
): { url: string; actionPrompt: string } | null {
  const excluded = new Set(excludedUrls.map(normSceneBackgroundUrl))

  const su = explicitChat?.url?.trim()
  if (su && isPersistableSceneImageUrl(su)) {
    const n = normSceneBackgroundUrl(su)
    if (!excluded.has(n)) {
      return {
        url: su,
        actionPrompt: explicitChat?.actionPrompt?.trim() ?? '',
      }
    }
  }

  const auto = pickExampleBackgroundFromUserText(lastUserText)
  if (auto) {
    const n = normSceneBackgroundUrl(auto.url)
    if (excluded.has(n))
      return null
    return { url: auto.url, actionPrompt: auto.actionPrompt }
  }

  return null
}
