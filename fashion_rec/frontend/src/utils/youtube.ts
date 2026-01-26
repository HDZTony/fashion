/**
 * YouTube URL utilities
 * Functions to extract video IDs and generate thumbnails from YouTube URLs
 */

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  // Remove whitespace
  const cleanUrl = url.trim()

  // Pattern 1: youtube.com/watch?v=VIDEO_ID or youtube.com/watch?feature=...&v=VIDEO_ID
  const watchMatch = cleanUrl.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/)
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1]
  }

  // Pattern 2: youtu.be/VIDEO_ID
  const shortMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1]
  }

  // Pattern 3: youtube.com/embed/VIDEO_ID
  const embedMatch = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1]
  }

  // Pattern 4: youtube.com/shorts/VIDEO_ID
  const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (shortsMatch && shortsMatch[1]) {
    return shortsMatch[1]
  }

  // Pattern 5: m.youtube.com/watch?v=VIDEO_ID
  const mobileMatch = cleanUrl.match(/m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/)
  if (mobileMatch && mobileMatch[1]) {
    return mobileMatch[1]
  }

  // Pattern 6: If it's just the video ID itself (11 characters, alphanumeric + _ and -)
  const directIdMatch = cleanUrl.match(/^([a-zA-Z0-9_-]{11})$/)
  if (directIdMatch && directIdMatch[1]) {
    return directIdMatch[1]
  }

  return null
}

/**
 * Check if a URL is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const cleanUrl = url.trim().toLowerCase()
  
  return (
    cleanUrl.includes('youtube.com') ||
    cleanUrl.includes('youtu.be') ||
    extractYouTubeVideoId(url) !== null
  )
}

/**
 * Generate YouTube thumbnail URL
 * @param videoId - YouTube video ID
 * @param quality - Thumbnail quality: 'maxresdefault' (1280x720), 'hqdefault' (480x360), 'mqdefault' (320x180), 'sddefault' (640x480)
 */
export function getYouTubeThumbnail(videoId: string, quality: 'maxresdefault' | 'hqdefault' | 'mqdefault' | 'sddefault' = 'maxresdefault'): string {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid video ID')
  }

  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
}

/**
 * Generate YouTube embed URL
 * @param videoId - YouTube video ID
 * @param options - Embed options (autoplay, rel, etc.)
 */
export function getYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean
    rel?: boolean
    modestbranding?: boolean
    loop?: boolean
    start?: number
  } = {}
): string {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid video ID')
  }

  const params = new URLSearchParams()
  
  if (options.autoplay) {
    params.append('autoplay', '1')
  }
  if (options.rel === false) {
    params.append('rel', '0')
  }
  if (options.modestbranding) {
    params.append('modestbranding', '1')
  }
  if (options.loop) {
    params.append('loop', '1')
    params.append('playlist', videoId) // Required for loop to work
  }
  if (options.start) {
    params.append('start', options.start.toString())
  }

  const queryString = params.toString()
  return `https://www.youtube.com/embed/${videoId}${queryString ? `?${queryString}` : ''}`
}
