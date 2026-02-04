/**
 * YouTube URL utilities for uniapp
 */

export function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const cleanUrl = url.trim().toLowerCase()
  return cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') || !!extractYouTubeVideoId(url)
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null
  const cleanUrl = url.trim()
  const watchMatch = cleanUrl.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/)
  if (watchMatch?.[1]) return watchMatch[1]
  const shortMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch?.[1]) return shortMatch[1]
  const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch?.[1]) return embedMatch[1]
  const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (shortsMatch?.[1]) return shortsMatch[1]
  const directMatch = cleanUrl.match(/^([a-zA-Z0-9_-]{11})$/)
  if (directMatch?.[1]) return directMatch[1]
  return null
}

export function getYouTubeThumbnail(videoId: string, quality: 'maxresdefault' | 'hqdefault' = 'hqdefault'): string {
  if (!videoId) return ''
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
}

export function getYouTubeEmbedUrl(videoId: string, opts?: { rel?: boolean; modestbranding?: boolean }): string {
  if (!videoId) return ''
  const params = new URLSearchParams()
  if (opts?.rel === false) params.append('rel', '0')
  if (opts?.modestbranding) params.append('modestbranding', '1')
  const qs = params.toString()
  return `https://www.youtube.com/embed/${videoId}${qs ? `?${qs}` : ''}`
}
