/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * ChatKit HTTP endpoint. If unset: dev defaults to `/chatkit` (Vite proxy to `CHATKIT_API_BASE`);
   * production build defaults to `${VITE_API_URL}/chatkit` via `@/lib/chatkit-config`.
   */
  readonly VITE_CHATKIT_API_URL?: string
  /**
   * Domain key (starter / OpenAI dashboard name). Takes precedence over `VITE_CHATKIT_DOMAIN_KEY`.
   * @see https://platform.openai.com/settings/organization/security/domain-allowlist
   */
  readonly VITE_CHATKIT_API_DOMAIN_KEY?: string
  /** Alias for domain key; used if `VITE_CHATKIT_API_DOMAIN_KEY` is unset. Default in code: `local-dev`. */
  readonly VITE_CHATKIT_DOMAIN_KEY?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
