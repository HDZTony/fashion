/** R2 image URL to Cloudflare Image Resizing URL */
function getOptimizedImageUrl(
  originalUrl: string | null | undefined,
  size: 'thumbnail' | 'small' | 'medium' | 'large' = 'medium'
): string {
  if (!originalUrl) return ''
  if (originalUrl.includes('/cdn-cgi/image/')) return originalUrl
  if (!originalUrl.includes('r2.fashion-rec.com')) return originalUrl
  const presets: Record<string, { w: number; q: number }> = {
    thumbnail: { w: 200, q: 75 },
    small: { w: 400, q: 80 },
    medium: { w: 800, q: 85 },
    large: { w: 1200, q: 90 },
  }
  const { w, q } = presets[size] || presets.medium
  try {
    const u = new URL(originalUrl)
    return `${u.protocol}//${u.host}/cdn-cgi/image/width=${w},quality=${q}${u.pathname}`
  } catch {
    return originalUrl
  }
}

export const getThumbnailUrl = (url: string | null | undefined) => getOptimizedImageUrl(url, 'thumbnail')
export const getSmallImageUrl = (url: string | null | undefined) => getOptimizedImageUrl(url, 'small')
export const getMediumImageUrl = (url: string | null | undefined) => getOptimizedImageUrl(url, 'medium')
export const getLargeImageUrl = (url: string | null | undefined) => getOptimizedImageUrl(url, 'large')
