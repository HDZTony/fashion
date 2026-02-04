/**
 * Uni storage adapter for Supabase auth.
 * Maps getItem/setItem/removeItem to uni.getStorageSync/setStorageSync/removeStorageSync.
 */
export const uniStorage = {
  getItem(key: string): string | null {
    try {
      return uni.getStorageSync(key) ?? null
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      uni.setStorageSync(key, value)
    } catch (_) {}
  },
  removeItem(key: string): void {
    try {
      uni.removeStorageSync(key)
    } catch (_) {}
  },
}
