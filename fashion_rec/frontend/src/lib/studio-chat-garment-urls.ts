/**
 * Parse `garment_urls` from assistant text (e.g. tool output JSON from extract_isolated_garment_pieces_for_try_on).
 */
export function extractGarmentUrlsFromAssistantText(text: string): string[] {
  if (!text?.trim()) return []
  const needle = '"garment_urls"'
  const start = text.indexOf(needle)
  if (start < 0) return []
  let i = text.indexOf('[', start + needle.length)
  if (i < 0) return []
  let depth = 0
  for (let k = i; k < text.length; k++) {
    const c = text[k]
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        const slice = text.slice(i, k + 1)
        try {
          const arr = JSON.parse(slice) as unknown
          if (!Array.isArray(arr)) return []
          return arr.filter(
            (x): x is string =>
              typeof x === 'string' && /^https?:\/\//i.test(x.trim()),
          )
        } catch {
          return []
        }
      }
    }
  }
  return []
}
