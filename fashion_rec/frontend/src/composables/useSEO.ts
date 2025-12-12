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

  useHead({
    title: pageTitle.value,
    meta: [
      { name: 'description', content: description.value },
      { name: 'keywords', content: keywords.value },
      { name: 'author', content: author.value },
      { name: 'robots', content: robots.value },
      { property: 'og:title', content: pageTitle.value },
      { property: 'og:description', content: description.value },
      { property: 'og:site_name', content: defaultSEO.siteName },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: canonical.value },
      { property: 'og:image', content: image.value },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle.value },
      { name: 'twitter:description', content: description.value },
      { name: 'twitter:image', content: image.value },
      { name: 'twitter:site', content: defaultSEO.twitterHandle },
    ],
    link: [
      { rel: 'canonical', href: canonical.value },
    ],
  })
}

