import { ref, computed, onBeforeUnmount } from 'vue'
import { supabase } from '@/lib/supabase'

const session = ref<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null)
const isLoading = ref(true)
let unsubscribe: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null

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

const ensureListener = () => {
  if (unsubscribe) return
  unsubscribe = supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    isLoading.value = false
    if (typeof window !== 'undefined') {
      if (newSession?.access_token) {
        localStorage.setItem('auth_token', newSession.access_token)
      } else {
        localStorage.removeItem('auth_token')
      }
    }
  })
}

export const useAuthState = () => {
  ensureListener()
  if (isLoading.value) {
    void loadSession()
  }

  const isAuthenticated = computed(() => !!session.value)

  const stop = () => {
    if (unsubscribe) {
      unsubscribe.data.subscription.unsubscribe()
      unsubscribe = null
    }
  }

  onBeforeUnmount(stop)

  return {
    session,
    isAuthenticated,
    isLoading,
    refreshSession: loadSession,
  }
}

