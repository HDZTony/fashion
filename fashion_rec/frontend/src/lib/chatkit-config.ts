/**
 * ChatKit client config aligned with openai-chatkit-starter-app/chatkit/frontend/src/lib/config.ts
 */
import { API_URL } from '@/config/api'

export const readEnvString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

/**
 * `VITE_CHATKIT_API_URL` if set; else in dev `/chatkit` (Vite proxy); else `${API_URL}/chatkit`.
 */
export function getChatKitApiUrl(): string {
  const fromEnv = readEnvString(import.meta.env.VITE_CHATKIT_API_URL)
  if (fromEnv) return fromEnv
  if (import.meta.env.DEV) return '/chatkit'
  const base = API_URL.replace(/\/$/, '')
  return `${base}/chatkit`
}

/**
 * Starter name first (`VITE_CHATKIT_API_DOMAIN_KEY`), then `VITE_CHATKIT_DOMAIN_KEY`, else `local-dev`.
 */
export function getChatKitDomainKey(): string {
  return (
    readEnvString(import.meta.env.VITE_CHATKIT_API_DOMAIN_KEY) ??
    readEnvString(import.meta.env.VITE_CHATKIT_DOMAIN_KEY) ??
    'local-dev'
  )
}

/**
 * Direct upload URL for ChatKit `uploadStrategy` (same host as API + `/upload`).
 * @see https://openai.github.io/chatkit-js/api/openai/chatkit/type-aliases/fileuploadstrategy/
 */
export function getChatKitDirectUploadUrl(): string {
  const api = getChatKitApiUrl().replace(/\/$/, '')
  if (api.startsWith('http://') || api.startsWith('https://')) {
    return `${api}/upload`
  }
  const path = api.startsWith('/') ? api : `/${api}`
  if (typeof window === 'undefined') {
    return `${path}/upload`
  }
  return `${window.location.origin}${path}/upload`
}
