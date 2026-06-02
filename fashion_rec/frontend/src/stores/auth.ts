import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session } from '@supabase/supabase-js'
import { webTokenStorage } from '@hdz/auth'
import { supabase } from '@/lib/supabase'
import { useStudioStore } from '@/stores/studio'

const tokenStorage = webTokenStorage()

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const isLoading = ref(true)
  let unsubscribe: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null

  if (typeof window !== 'undefined') {
    const savedToken = localStorage.getItem('auth_token')
    if (savedToken) {
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

  const syncToken = (next: Session | null) => {
    session.value = next
    if (next?.access_token) tokenStorage.setAccessToken(next.access_token)
    else tokenStorage.clearAccessToken()
  }

  const isAuthenticated = computed(() => !!session.value)
  const user = computed(() => session.value?.user ?? null)
  const accessToken = computed(
    () => session.value?.access_token ?? tokenStorage.getAccessToken(),
  )

  const loadSession = async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) console.warn('Failed to get Supabase session', error)
    syncToken(data.session ?? null)
    isLoading.value = false
    return session.value
  }

  const refreshSession = async () => loadSession()

  const setupAuthListener = () => {
    if (unsubscribe) return
    unsubscribe = supabase.auth.onAuthStateChange((_event, newSession) => {
      syncToken(newSession)
      isLoading.value = false
      if (!newSession) {
        try {
          const studioStore = useStudioStore()
          studioStore.clearState()
          sessionStorage.removeItem('studio-store')
        } catch (e) {
          console.warn('[Auth Store] Failed to clear studio store:', e)
          sessionStorage.removeItem('studio-store')
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

  if (typeof window !== 'undefined') {
    setupAuthListener()
    loadSession()
  } else {
    isLoading.value = false
  }

  return {
    session,
    isLoading,
    isAuthenticated,
    user,
    accessToken,
    loadSession,
    refreshSession,
    setupAuthListener,
    cleanup,
  }
}, {
  persist: typeof window !== 'undefined'
    ? { key: 'auth-store', storage: localStorage }
    : false,
})
