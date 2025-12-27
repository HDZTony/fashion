import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  // State
  const session = ref<Session | null>(null)
  const isLoading = ref(true)
  let unsubscribe: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null

  // Getters
  const isAuthenticated = computed(() => !!session.value)
  const user = computed(() => session.value?.user ?? null)
  const accessToken = computed(() => session.value?.access_token ?? null)

  // Actions
  const loadSession = async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Failed to get Supabase session', error)
    }
    session.value = data.session ?? null
    isLoading.value = false

    // Keep legacy localStorage token in sync for existing logic
    if (typeof window !== 'undefined') {
      if (session.value?.access_token) {
        localStorage.setItem('auth_token', session.value.access_token)
      } else {
        localStorage.removeItem('auth_token')
      }
    }

    return session.value
  }

  const refreshSession = async () => {
    return await loadSession()
  }

  const setupAuthListener = () => {
    if (unsubscribe) return

    unsubscribe = supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      isLoading.value = false

      // Sync to localStorage for backward compatibility
      if (typeof window !== 'undefined') {
        if (newSession?.access_token) {
          localStorage.setItem('auth_token', newSession.access_token)
        } else {
          localStorage.removeItem('auth_token')
        }
      }
    })
  }

  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe.data.subscription.unsubscribe()
      unsubscribe = null
    }
  }

  // Initialize on store creation (only in browser, not in SSR)
  // This prevents SSR from trying to access localStorage or Supabase session
  if (typeof window !== 'undefined') {
    setupAuthListener()
    loadSession()
  } else {
    // In SSR, mark as not loading since we can't load session
    isLoading.value = false
  }

  return {
    // State
    session,
    isLoading,
    // Getters
    isAuthenticated,
    user,
    accessToken,
    // Actions
    loadSession,
    refreshSession,
    setupAuthListener,
    cleanup,
  }
}, {
  // Persist configuration (only in browser, not in SSR)
  persist: typeof window !== 'undefined' ? {
    key: 'auth-store',
    storage: localStorage,
  } : false,
})

