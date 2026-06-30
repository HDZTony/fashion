import { createSupabaseAuthClient } from '@hdz/auth'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://fashion-rec.com/supabase'
const supabaseKey =
  import.meta.env.VITE_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZmhjY3JlbHB1Y3Bwb2dubHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzU4NjQsImV4cCI6MjA3OTYxMTg2NH0.9xB3Peua7MeaRGYPsSrmHYbpWpQmyqpJSSNqyGjqdIo'

export const supabase = createSupabaseAuthClient({
  url: supabaseUrl,
  anonKey: supabaseKey,
  storage: typeof window !== 'undefined' ? window.localStorage : ({} as Storage),
  detectSessionInUrl: typeof window !== 'undefined',
})
