/**
 * Extract a try-on / result image URL from assistant markdown (Studio chat inline preview).
 */
const CDN_HOST_RE = /fashion-rec\.com|fashion_rec\.com|r2\.dev/i

const PAREN_IMAGE_URL_RE =
  /\((https?:\/\/[^)\s]+\.(?:png|jpe?g|webp|gif)(?:\?[^)\s]*)?)\)/gi

function collectParenImageUrls(text: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(PAREN_IMAGE_URL_RE.source, PAREN_IMAGE_URL_RE.flags)
  while ((m = re.exec(text)) !== null) {
    out.push(m[1])
  }
  return out
}

export function extractStudioResultImageUrl(text: string): string | null {
  if (!text?.trim()) return null

  const cdnBare = text.match(
    /https?:\/\/[^\s)<>"']*(?:fashion-rec\.com|fashion_rec\.com|r2\.dev)[^\s)<>"']*\.(?:png|jpe?g|webp|gif)(?:\?[^\s)<>"']*)?/i,
  )
  if (cdnBare?.[0]) return cdnBare[0]

  const mdImg = text.match(
    /!\[[^\]]*]\((https?:\/\/[^)]+\.(?:png|jpe?g|webp|gif)[^)]*)\)/i,
  )
  if (mdImg?.[1]) return mdImg[1]

  const mdLink = text.match(
    /\[([^\]]*)]\((https?:\/\/[^)]+\.(?:png|jpe?g|webp|gif)[^)]*)\)/i,
  )
  if (mdLink?.[2]) return mdLink[2]

  const candidates = collectParenImageUrls(text)
  const preferred = candidates.find((u) => CDN_HOST_RE.test(u))
  if (preferred) return preferred
  if (candidates[0]) return candidates[0]

  const any = text.match(
    /https?:\/\/[^\s)<>"']+\.(?:png|jpe?g|webp|gif)(?:\?[^\s)<>"']*)?/i,
  )
  return any?.[0] ?? null
}

/** Remove markdown image/link/bare line for this URL so we don't render the same picture twice. */
export function stripStudioResultImageFromMarkdown(text: string, url: string): string {
  const u = url.trim()
  if (!u || !text) return text
  const esc = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let s = text
  s = s.replace(new RegExp(`!\\[[^\\]]*\\]\\(${esc}\\)`, 'gi'), '')
  s = s.replace(new RegExp(`\\[[^\\]]*\\]\\(${esc}\\)`, 'gi'), '')
  s = s.replace(new RegExp(`^\\s*${esc}\\s*$`, 'gim'), '')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trimEnd()
}

export function isStudioResultPreviewableUrl(href: string): boolean {
  try {
    const u = new URL(href)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (CDN_HOST_RE.test(u.hostname)) return true
    return /\.(png|jpe?g|webp|gif)$/i.test(u.pathname)
  } catch {
    return false
  }
}
