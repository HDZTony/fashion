export const siteBaseUrl =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || 'https://fashion-rec.com'

export const defaultSEO = {
  title: 'Fashion Rec - AI Virtual Try-On & Smart Wardrobe',
  description: 'Try on clothes virtually with AI. Get personalized outfit recommendations and manage your wardrobe intelligently. Discover your perfect style today.',
  keywords: [
    'virtual try on',
    'AI fashion',
    'outfit recommendations',
    'wardrobe management',
    'online clothing try on',
    'personal stylist AI',
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
