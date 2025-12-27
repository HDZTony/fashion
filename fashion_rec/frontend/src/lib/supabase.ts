import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eufhccrelpucppognlym.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZmhjY3JlbHB1Y3Bwb2dubHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzU4NjQsImV4cCI6MjA3OTYxMTg2NH0.9xB3Peua7MeaRGYPsSrmHYbpWpQmyqpJSSNqyGjqdIo'

/**
 * Create Supabase client with explicit session persistence configuration.
 * 
 * This configuration ensures:
 * 1. Sessions are persisted in localStorage (survives page refresh)
 * 2. Tokens are automatically refreshed before expiration
 * 3. Session is detected from URL (for OAuth callbacks)
 * 4. Uses PKCE flow for better security
 * 
 * This is critical for handling browser-initiated requests (page refresh, direct URL navigation)
 * where the session needs to be recovered from storage.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use localStorage for session persistence (survives page refresh)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Ensure sessions are persisted to storage
    persistSession: true,
    // Automatically refresh tokens before expiration
    autoRefreshToken: true,
    // Detect session from URL (important for OAuth callbacks)
    detectSessionInUrl: true,
    // Use PKCE flow for better security (recommended for OAuth)
    flowType: 'pkce',
  },
})
