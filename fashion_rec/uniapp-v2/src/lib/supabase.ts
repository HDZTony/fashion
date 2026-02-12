/**
 * Supabase 客户端 - 使用本地 fork 的 @supabase/supabase-js（已做 uniapp 适配）
 * fork 内部已用 resolveURL / resolveURLSearchParams / resolveHeadersConstructor 替代全局 Web API，
 * 无需额外 polyfill。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/auth-js'
import { uniStorage } from './storage'

const DEFAULT_SUPABASE_URL = 'https://eufhccrelpucppognlym.supabase.co'

function resolveSupabaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string)?.trim()
  if (!raw || raw === 'undefined' || raw === 'null')
    return DEFAULT_SUPABASE_URL
  if (raw.startsWith('https://') && raw.includes('.supabase.co'))
    return raw.replace(/\/+$/, '')
  return DEFAULT_SUPABASE_URL
}

const SUPABASE_URL = resolveSupabaseUrl()
const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_KEY as string)?.trim()
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZmhjY3JlbHB1Y3Bwb2dubHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzU4NjQsImV4cCI6MjA3OTYxMTg2NH0.9xB3Peua7MeaRGYPsSrmHYbpWpQmyqpJSSNqyGjqdIo'

console.log('[Supabase] URL:', JSON.stringify(SUPABASE_URL), 'KEY length:', SUPABASE_KEY?.length)

const storageAdapter = {
  getItem: (key: string) => Promise.resolve(uniStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    uniStorage.setItem(key, value)
    return Promise.resolve()
  },
  removeItem: (key: string) => {
    uniStorage.removeItem(key)
    return Promise.resolve()
  },
}

// fork 内部 resolveFetch 会自动检测 globalThis.uni 并使用 createUniFetchInternal()
// 无需手动传入 customFetch

let _client: SupabaseClient
try {
  _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: storageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  })
  console.log('[Supabase] createClient OK')
}
catch (e) {
  console.error('[Supabase] createClient failed:', e)
  // 创建一个空壳避免页面白屏
  _client = {} as SupabaseClient
}

export const supabase = _client

export type { User }

export async function applyNativeSession(session: {
  access_token: string
  refresh_token: string
}) {
  const { data, error } = await _client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error)
    throw error
  const token = data.session?.access_token || session.access_token
  try {
    uni.setStorageSync('auth_token', token)
  }
  catch (_) {}
  return data.session
}
