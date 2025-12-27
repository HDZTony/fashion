import { ref, computed, onBeforeUnmount } from 'vue'
import { supabase } from '@/lib/supabase'

const session = ref<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null>(null)
const isLoading = ref(true)
let unsubscribe: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null

const loadSession = async () => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:8',message:'loadSession entry',data:{isLoading:isLoading.value,hasWindow:typeof window!=='undefined',existingToken:typeof window!=='undefined'?localStorage.getItem('auth_token')?.substring(0,20)||null:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.warn('Failed to get Supabase session', error)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:11',message:'loadSession getSession error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  }
  session.value = data.session ?? null
  isLoading.value = false
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:15',message:'loadSession got session',data:{hasSession:!!session.value,hasToken:!!session.value?.access_token,tokenPrefix:session.value?.access_token?.substring(0,20)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  // Keep legacy localStorage token in sync for existing logic
  if (typeof window !== 'undefined') {
    if (session.value?.access_token) {
      localStorage.setItem('auth_token', session.value.access_token)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:19',message:'Saved token to localStorage',data:{tokenPrefix:session.value.access_token.substring(0,20)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
      // #endregion
    } else {
      localStorage.removeItem('auth_token')
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:22',message:'Removed token from localStorage',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:43',message:'useAuthState called',data:{isLoading:isLoading.value,hasSession:!!session.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  if (isLoading.value) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:46',message:'Calling loadSession (isLoading=true)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    void loadSession()
  } else {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuthState.ts:49',message:'Skipping loadSession (isLoading=false)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
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

