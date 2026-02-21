import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

export type GetTokenFn = () => string | null
export type On401Fn = () => Promise<void>

export interface CreateApiClientOptions {
  baseURL: string
  getToken: GetTokenFn
  on401?: On401Fn
  timeout?: number
  /** Max retries for 502/503/504 gateway errors (default: 2) */
  gatewayRetries?: number
}

const RETRYABLE_STATUS_CODES = [502, 503, 504]
const MAX_GATEWAY_RETRIES = 2
const RETRY_BASE_DELAY_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create an axios instance with auth token injection.
 * Environment-agnostic: getToken is provided by the app (e.g. localStorage for web, uni.getStorageSync for uniapp).
 */
export function createAuthenticatedApiClient(options: CreateApiClientOptions): AxiosInstance {
  const { baseURL, getToken, on401, timeout = 30000 } = options
  const maxRetries = options.gatewayRetries ?? MAX_GATEWAY_RETRIES

  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout,
  })

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    const token = getToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    } else {
      console.warn('[API Client] No auth token available for request:', config.method?.toUpperCase(), config.url)
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      if (!originalRequest) return Promise.reject(error)

      // Retry on 502/503/504 (gateway errors, typically backend temporarily unavailable)
      const status = error.response?.status
      if (status && RETRYABLE_STATUS_CODES.includes(status)) {
        const retryCount: number = originalRequest._gatewayRetryCount ?? 0
        if (retryCount < maxRetries) {
          originalRequest._gatewayRetryCount = retryCount + 1
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount)
          console.warn(
            `[API Client] ${status} on ${originalRequest.method?.toUpperCase()} ${originalRequest.url}, retry ${retryCount + 1}/${maxRetries} in ${delay}ms`,
          )
          await sleep(delay)
          return client(originalRequest)
        }
      }

      // Refresh token on 401
      if (status === 401 && !originalRequest._retry && on401) {
        originalRequest._retry = true
        try {
          await on401()
          const token = getToken()
          if (token) {
            originalRequest.headers = originalRequest.headers || {}
            originalRequest.headers.Authorization = `Bearer ${token}`
            return client(originalRequest)
          }
        } catch (e) {
          console.warn('[API Client] on401 failed:', e)
        }
      }
      return Promise.reject(error)
    }
  )

  return client
}
