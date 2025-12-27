import { defineStore } from 'pinia'
import { ref, computed, onBeforeUnmount } from 'vue'
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
    // #region agent log
    if (typeof window !== 'undefined') {
      fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'stores/auth.ts:18',message:'loadSession entry',data:{isLoading:isLoading.value,hasWindow:typeof window!=='undefined',existingToken:typeof window!=='undefined'?localStorage.getItem('auth_token')?.substring(0,20)||null:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
    }
    // #endregion
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Failed to get Supabase session', error)
      // #region agent log
      if (typeof window !== 'undefined') {
        fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'stores/auth.ts:23',message:'loadSession getSession error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      }
      // #endregion
    }
    session.value = data.session ?? null
    isLoading.value = false
    // #region agent log
    if (typeof window !== 'undefined') {
      fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'stores/auth.ts:28',message:'loadSession got session',data:{hasSession:!!session.value,hasToken:!!session.value?.access_token,tokenPrefix:session.value?.access_token?.substring(0,20)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    }
    // #endregion

    // Keep legacy localStorage token in sync for existing logic
    if (typeof window !== 'undefined') {
      if (session.value?.access_token) {
        localStorage.setItem('auth_token', session.value.access_token)
        // #region agent log
        if (typeof window !== 'undefined') {
          fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'stores/auth.ts:35',message:'Saved token to localStorage',data:{tokenPrefix:session.value.access_token.substring(0,20)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
        }
        // #endregion
      } else {
        localStorage.removeItem('auth_token')
        // #region agent log
        if (typeof window !== 'undefined') {
          fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'stores/auth.ts:40',message:'Removed token from localStorage',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        }
        // #endregion
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

  // Initialize on store creation
  setupAuthListener()
  loadSession()

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
  // Persist configuration
  persist: {
    key: 'auth-store',
    storage: localStorage,
    paths: ['session'], // Only persist session, not isLoading
  },
})

