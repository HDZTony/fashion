export const siteBaseUrl =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '')

export const defaultSEO = {
  title: 'Fashion AI Wardrobe',
  description: 'AI-powered virtual try-on, smart outfit recommendations, and personalized wardrobe management.',
  keywords: [
    'AI fashion',
    'virtual try-on',
    'wardrobe management',
    'outfit recommendations',
    'fashion ai',
    'try on clothes online',
  ].join(', '),
  author: 'Fashion AI Wardrobe',
  siteName: 'Fashion AI Wardrobe',
  twitterHandle: '@fashion_ai',
  ogImage: `${siteBaseUrl}/images/brand/hdz.png`,
}

export const publicRoutes = ['/', '/pricing', '/privacy-policy', '/terms-of-service']

