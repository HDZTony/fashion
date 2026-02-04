/**
 * API URL configuration - environment agnostic.
 * Each app (frontend / uniapp) should pass its own API_URL when creating the client.
 * Frontend uses import.meta.env.VITE_API_URL; uniapp uses process.env or manifest.
 */
export const DEFAULT_DEV_URL = 'http://127.0.0.1:8787'
export const DEFAULT_PROD_URL = 'https://fashion-rec.com'

export type ApiConfigOptions = {
  apiUrl?: string
  subscriptionApiUrl?: string
  isProduction?: boolean
}

/**
 * Resolve API URL from options. Used by frontend (with import.meta.env) or uniapp (with process.env).
 */
export function getApiUrl(options: ApiConfigOptions = {}): string {
  const { apiUrl, isProduction = false } = options
  if (isProduction) {
    return apiUrl || DEFAULT_PROD_URL
  }
  if (apiUrl && (apiUrl.includes('8787') || apiUrl.includes('fashion-rec.com') || apiUrl.includes('hdz73.com'))) {
    return apiUrl
  }
  return DEFAULT_DEV_URL
}

/**
 * Resolve subscription API URL. Defaults to same as API_URL (router handles routing).
 */
export function getSubscriptionApiUrl(options: ApiConfigOptions = {}): string {
  return options.subscriptionApiUrl ?? getApiUrl(options)
}
