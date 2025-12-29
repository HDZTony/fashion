import { ref, computed } from 'vue'
import { apiClient } from '@/lib/api-client'

/**
 * Composable for managing user frontend version (stable/v2)
 */
export function useVersion() {
  const currentVersion = ref<'stable' | 'v2' | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Get current user's frontend version
   * Returns 'stable' or 'v2', defaults to 'stable' if not set
   */
  const getVersion = async (): Promise<'stable' | 'v2'> => {
    isLoading.value = true
    error.value = null

    try {
      // Call API to get version (apiClient handles authentication automatically)
      const response = await apiClient.get('/api/router/get-version', {
        withCredentials: true,
      })

      const version = response.data.version as 'stable' | 'v2'
      currentVersion.value = version || 'stable'
      return currentVersion.value
    } catch (e: any) {
      console.error('Failed to get version:', e)
      error.value = e?.response?.data?.error || e?.message || 'Failed to get version'
      // Default to stable on error (including auth errors)
      currentVersion.value = 'stable'
      return 'stable'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Set user's frontend version
   */
  const setVersion = async (version: 'stable' | 'v2'): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      // Call API to set version (apiClient handles authentication automatically)
      const response = await apiClient.post(
        '/api/router/set-version',
        { version },
        {
          withCredentials: true,
        }
      )

      if (response.data.success) {
        currentVersion.value = version
        return true
      } else {
        error.value = 'Failed to set version'
        return false
      }
    } catch (e: any) {
      console.error('Failed to set version:', e)
      error.value = e?.response?.data?.error || e?.message || 'Failed to set version'
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if current version is v2
   */
  const isV2 = computed(() => currentVersion.value === 'v2')

  /**
   * Check if current version is stable
   */
  const isStable = computed(() => currentVersion.value === 'stable')

  return {
    currentVersion,
    isLoading,
    error,
    getVersion,
    setVersion,
    isV2,
    isStable,
  }
}

