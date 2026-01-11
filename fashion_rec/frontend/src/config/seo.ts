export const siteBaseUrl =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || 'https://fashion-rec.com'

export const defaultSEO = {
  title: 'Fashion Rec',
  description: 'AI-powered virtual try-on, smart outfit recommendations, and personalized wardrobe management.',
  keywords: [
    'AI fashion',
    'virtual try-on',
    'wardrobe management',
    'outfit recommendations',
    'fashion ai',
    'try on clothes online',
  ].join(', '),
  author: 'Fashion Rec',
  siteName: 'Fashion Rec',
  twitterHandle: '@fashionrec',
  ogImage: `${siteBaseUrl}/images/brand/hdz.png`,
}

export const publicRoutes = ['/', '/pricing', '/privacy-policy', '/terms-of-service']

/**
 * Organization structured data (JSON-LD)
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fashion Rec',
  url: siteBaseUrl,
  logo: `${siteBaseUrl}/images/brand/hdz.png`,
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@fashion-rec.com',
    contactType: 'Customer Service',
  },
  sameAs: [
    `https://twitter.com/${defaultSEO.twitterHandle.replace('@', '')}`,
  ],
}

/**
 * WebSite structured data (JSON-LD)
 */
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: defaultSEO.siteName,
  url: siteBaseUrl,
  description: defaultSEO.description,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteBaseUrl}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}
