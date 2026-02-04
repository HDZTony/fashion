/**
 * Polyfill: 在 UniApp H5 中，部分环境（iframe、跨域等）无法访问 localStorage，
 * 导致 SecurityError。用 uni 存储 API 替代，确保第三方库能正常读写持久化数据。
 */
import { uniStorage } from './lib/storage'

function installStoragePolyfill() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.getItem('__storage_test__')
  } catch {
    const polyfill = {
      getItem(key: string): string | null {
        return uniStorage.getItem(key)
      },
      setItem(key: string, value: string): void {
        uniStorage.setItem(key, value)
      },
      removeItem(key: string): void {
        try {
          uniStorage.removeItem(key)
        } catch (_) {}
      },
      clear(): void {
        try {
          const info = uni.getStorageInfoSync()
          if (info?.keys) {
            info.keys.forEach((k) => uni.removeStorageSync(k))
          }
        } catch (_) {}
      },
      get length(): number {
        try {
          return uni.getStorageInfoSync()?.keys?.length ?? 0
        } catch {
          return 0
        }
      },
      key(index: number): string | null {
        try {
          const keys = uni.getStorageInfoSync()?.keys ?? []
          return keys[index] ?? null
        } catch {
          return null
        }
      },
    }
    try {
      Object.defineProperty(window, 'localStorage', {
        value: polyfill,
        writable: false,
        configurable: true,
      })
    } catch (_) {}
  }
}

installStoragePolyfill()
