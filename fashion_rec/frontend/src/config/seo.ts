export const siteBaseUrl =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '')

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

