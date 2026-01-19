import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { setTokenInCookie, removeTokenFromCookie, getTokenFromCookie } from '@/lib/cookie-storage'
import { useStudioStore } from '@/stores/studio'

export const useAuthStore = defineStore('auth', () => {
  // State
  const session = ref<Session | null>(null)
  const isLoading = ref(true)
  let unsubscribe: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null

  // CRITICAL: Immediately restore token from localStorage on store creation (synchronous)
  // This ensures token is available even before async loadSession() completes
  // This is essential for page refresh scenarios where requests might be made immediately
  if (typeof window !== 'undefined') {
    const savedToken = localStorage.getItem('auth_token')
    if (savedToken) {
      // Try to restore session from persisted state first (if available)
      // The persist plugin should have restored it, but we also check localStorage as backup
      try {
        const persistedAuth = localStorage.getItem('auth-store')
        if (persistedAuth) {
          const parsed = JSON.parse(persistedAuth)
          if (parsed?.session?.access_token) {
            session.value = parsed.session
            isLoading.value = false
          }
        }
      } catch (e) {
        console.warn('[Auth Store] Failed to parse persisted auth state:', e)
      }
    }
  }

  // Getters
  const isAuthenticated = computed(() => !!session.value)
  const user = computed(() => session.value?.user ?? null)
  const accessToken = computed(() => {
    // CRITICAL: Priority order: session -> localStorage -> cookie
    // This ensures token is available immediately on page refresh
    if (session.value?.access_token) {
      return session.value.access_token
    }
    if (typeof window !== 'undefined') {
      // Try localStorage first (faster)
      const token = localStorage.getItem('auth_token')
      if (token) {
        return token
      }
      // Fallback to cookie (for browser-initiated requests)
      const cookieToken = getTokenFromCookie()
      if (cookieToken) {
        return cookieToken
      }
    }
    return null
  })

  // Actions
  const loadSession = async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Failed to get Supabase session', error)
    }
    session.value = data.session ?? null
    isLoading.value = false

    // Sync token to both localStorage and cookie for maximum compatibility
    if (typeof window !== 'undefined') {
      if (session.value?.access_token) {
        localStorage.setItem('auth_token', session.value.access_token)
        setTokenInCookie(session.value.access_token)
      } else {
        localStorage.removeItem('auth_token')
        removeTokenFromCookie()
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

      // Sync to both localStorage and cookie
      if (typeof window !== 'undefined') {
        if (newSession?.access_token) {
          localStorage.setItem('auth_token', newSession.access_token)
          setTokenInCookie(newSession.access_token)
        } else {
          localStorage.removeItem('auth_token')
          removeTokenFromCookie()
          
          // Clear Studio cache when session is cleared (logout)
          // This ensures cache is cleared even if user logs out from other tabs or via API
          try {
            const studioStore = useStudioStore()
            studioStore.clearState()
            sessionStorage.removeItem('studio-store')
            sessionStorage.removeItem('wardrobe_items_cache')
            localStorage.removeItem('fashion-rec_selected_items')
          } catch (e) {
            // If studio store is not available (e.g., during SSR), just clear storage directly
            console.warn('[Auth Store] Failed to clear studio store, clearing storage directly:', e)
            sessionStorage.removeItem('studio-store')
            sessionStorage.removeItem('wardrobe_items_cache')
            localStorage.removeItem('fashion-rec_selected_items')
          }
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

