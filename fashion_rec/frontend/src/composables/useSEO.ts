import { computed } from 'vue'
import { useHead } from '@vueuse/head'
import { defaultSEO, siteBaseUrl } from '@/config/seo'

type SEOOptions = {
  title?: string
  description?: string
  keywords?: string
  author?: string
  canonical?: string
  path?: string
  image?: string
  robots?: string
}

export function useSEO(options: SEOOptions = {}) {
  const pageTitle = computed(() => options.title || defaultSEO.title)
  const description = computed(() => options.description || defaultSEO.description)
  const keywords = computed(() => options.keywords || defaultSEO.keywords)
  const author = computed(() => options.author || defaultSEO.author)
  const robots = computed(() => options.robots || 'index,follow')

  const canonical = computed(() => {
    if (options.canonical) return options.canonical
    const path = options.path || '/'
    return `${siteBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
  })

  const image = computed(() => options.image || defaultSEO.ogImage)

  // Ensure og:image uses absolute URL
  const absoluteImage = computed(() => {
    if (!image.value) return ''
    if (image.value.startsWith('http://') || image.value.startsWith('https://')) {
      return image.value
    }
    return `${siteBaseUrl || 'https://fashion-rec.com'}${image.value.startsWith('/') ? image.value : `/${image.value}`}`
  })

  useHead({
    title: pageTitle.value,
    meta: [
      { name: 'description', content: description.value },
      { name: 'keywords', content: keywords.value },
      { name: 'author', content: author.value },
      { name: 'robots', content: robots.value },
      { name: 'theme-color', content: '#ec4899' },
      // Google Explore large image preview
      { name: 'max-image-preview', content: 'large' },
      // Open Graph tags
      { property: 'og:title', content: pageTitle.value },
      { property: 'og:description', content: description.value },
      { property: 'og:site_name', content: defaultSEO.siteName },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: canonical.value },
      { property: 'og:image', content: absoluteImage.value },
      { property: 'og:locale', content: 'en_US' },
      // Twitter Card tags
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle.value },
      { name: 'twitter:description', content: description.value },
      { name: 'twitter:image', content: absoluteImage.value },
      { name: 'twitter:site', content: defaultSEO.twitterHandle },
    ],
    link: [
      { rel: 'canonical', href: canonical.value },
    ],
  })
}

