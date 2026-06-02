/**
 * Supabase 客户端 — 使用共享 @hdz/auth（与 Fashion Web / Wormhole 同一套逻辑）
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/auth-js'
import { createSupabaseAuthClient, uniTokenStorage } from '@hdz/auth'
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

const tokenStorage = uniTokenStorage(uniStorage)

let _client: SupabaseClient
try {
  _client = createSupabaseAuthClient({
    url: SUPABASE_URL,
    anonKey: SUPABASE_KEY,
    storage: storageAdapter as unknown as Storage,
    detectSessionInUrl: false,
  })
  console.log('[Supabase] createClient OK')
}
catch (e) {
  console.error('[Supabase] createClient failed:', e)
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
  tokenStorage.setAccessToken(token)
}
