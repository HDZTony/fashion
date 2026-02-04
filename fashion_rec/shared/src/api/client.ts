import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

export type GetTokenFn = () => string | null
export type On401Fn = () => Promise<void>

export interface CreateApiClientOptions {
  baseURL: string
  getToken: GetTokenFn
  on401?: On401Fn
  timeout?: number
}

/**
 * Create an axios instance with auth token injection.
 * Environment-agnostic: getToken is provided by the app (e.g. localStorage for web, uni.getStorageSync for uniapp).
 */
export function createAuthenticatedApiClient(options: CreateApiClientOptions): AxiosInstance {
  const { baseURL, getToken, on401, timeout = 30000 } = options

  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout,
  })

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    // When sending FormData, remove Content-Type so browser/runtime sets multipart boundary
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
      if (error.response?.status === 401 && !originalRequest._retry && on401) {
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
