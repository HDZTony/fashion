import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { uniStorage } from './storage'
import { createUniFetch } from './uni-fetch'

const DEFAULT_SUPABASE_URL = 'https://eufhccrelpucppognlym.supabase.co'

function resolveSupabaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string)?.trim()
  if (!raw || raw === 'undefined' || raw === 'null') return DEFAULT_SUPABASE_URL
  if (raw.startsWith('https://') && raw.includes('.supabase.co')) return raw
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

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    const url = (SUPABASE_URL || DEFAULT_SUPABASE_URL).trim()
    const key = (SUPABASE_KEY || '').trim()
    if (!url || !key) {
      throw new Error('[Supabase] URL or KEY is empty. Check supabase.ts')
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error(`[Supabase] Invalid URL format: "${url}". Must start with http:// or https://`)
    }
    _client = createClient(url, key, {
      global: {
        fetch: createUniFetch(),
      },
      auth: {
        storage: storageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  }
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getClient() as Record<string | symbol, unknown>)[prop]
  },
})
