export type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original'

interface ImageOptimizeOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
}

const SIZE_PRESETS: Record<ImageSize, { width?: number; height?: number; quality: number }> = {
  thumbnail: { width: 200, height: 200, quality: 75 },
  small: { width: 400, height: 400, quality: 80 },
  medium: { width: 800, height: 800, quality: 85 },
  large: { width: 1200, height: 1200, quality: 90 },
  original: { quality: 95 }
}

/**
 * 将 R2 图片 URL 转换为 Cloudflare Image Resizing URL
 * @param originalUrl 原始 R2 URL，例如: https://r2.fashion-rec.com/example/image.jpg
 * @param size 预设尺寸
 * @param options 自定义选项（会覆盖预设）
 * @returns 优化后的 URL，例如: https://r2.fashion-rec.com/cdn-cgi/image/width=800,quality=85/example/image.jpg
 */
export function getOptimizedImageUrl(
  originalUrl: string | null | undefined,
  size: ImageSize = 'medium',
  options?: Partial<ImageOptimizeOptions>
): string {
  if (!originalUrl) return ''

  // 已经是优化后的 URL（包含 /cdn-cgi/image/）
  if (originalUrl.includes('/cdn-cgi/image/')) {
    return originalUrl
  }

  // 非 R2 域名，直接返回
  if (!originalUrl.includes('r2.fashion-rec.com')) {
    return originalUrl
  }

  const preset = SIZE_PRESETS[size]
  const urlObj = new URL(originalUrl)
  const imagePath = urlObj.pathname

  const transformOptions: string[] = []

  const width = options?.width ?? preset.width
  const height = options?.height ?? preset.height
  if (width) transformOptions.push(`width=${width}`)
  if (height) transformOptions.push(`height=${height}`)

  const quality = options?.quality ?? preset.quality
  transformOptions.push(`quality=${quality}`)

  const format = options?.format ?? 'auto'
  if (format !== 'auto') {
    transformOptions.push(`format=${format}`)
  }

  if (options?.fit) {
    transformOptions.push(`fit=${options.fit}`)
  }

  const baseUrl = `${urlObj.protocol}//${urlObj.host}`
  const optionsString = transformOptions.join(',')

  return `${baseUrl}/cdn-cgi/image/${optionsString}${imagePath}`
}

// 便捷函数
export const getThumbnailUrl = (url: string) => getOptimizedImageUrl(url, 'thumbnail')
export const getSmallImageUrl = (url: string) => getOptimizedImageUrl(url, 'small')
export const getMediumImageUrl = (url: string) => getOptimizedImageUrl(url, 'medium')
export const getLargeImageUrl = (url: string) => getOptimizedImageUrl(url, 'large')
