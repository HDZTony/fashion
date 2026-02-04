/**
 * Alova-based API client with Fashion Rec auth (Supabase + Bearer token).
 * Provides axios-like interface for migration compatibility.
 */
import AdapterUniapp from '@alova/adapter-uniapp'
import { createAlova } from 'alova'
import VueHook from 'alova/vue'
import { API_URL, SUBSCRIPTION_API_URL } from '@/config/api'
import { supabase } from './supabase'
import { pushApiLog } from './apiDebug'

function getToken(): string | null {
  try {
    return uni.getStorageSync('auth_token') ?? null
  } catch {
    return null
  }
}

async function handle401(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data?.session?.access_token) {
    uni.setStorageSync('auth_token', data.session.access_token)
  } else {
    await supabase.auth.signOut()
    uni.removeStorageSync('auth_token')
    uni.navigateTo({ url: '/pages/login/login' })
  }
}

function createFashionApiClient(baseURL: string, timeout: number) {
  const alova = createAlova({
    baseURL,
    ...AdapterUniapp(),
    timeout,
    statesHook: VueHook,

    beforeRequest(method) {
      ;(method as unknown as { __debugStart?: number }).__debugStart = Date.now()
      method.config.headers = method.config.headers || {}
      // FormData: omit Content-Type so runtime sets multipart boundary
      if (typeof FormData !== 'undefined' && method.config.data instanceof FormData) {
        // Do not set Content-Type for FormData
      } else {
        method.config.headers['Content-Type'] = 'application/json'
      }
      method.config.headers.Accept = 'application/json, text/plain, */*'

      const token = getToken()
      if (token) {
        method.config.headers.Authorization = `Bearer ${token}`
      }
    },

    responded: {
      onSuccess: async (response, method) => {
        const { statusCode, data: rawData, errMsg } = response as UniNamespace.RequestSuccessCallbackResult
        const m = method as unknown as { __debugStart?: number; url?: string; type?: string }
        const duration = m.__debugStart ? Date.now() - m.__debugStart : 0
        const url = m.url ?? ''
        const methodType = (m.type ?? 'GET').toUpperCase()

        // Upload/download: return raw response
        if (method.config.requestType === 'upload' || method.config.requestType === 'download') {
          pushApiLog({ method: methodType, url, status: statusCode, duration })
          return response
        }

        if (statusCode === 401) {
          pushApiLog({ method: methodType, url, status: statusCode, duration, preview: '401 Unauthorized' })
          await handle401()
          const token = getToken()
          if (token) {
            return method.send()
          }
          throw new Error('Unauthorized')
        }

        if (statusCode !== 200) {
          pushApiLog({ method: methodType, url, status: statusCode, duration, preview: `${statusCode}: ${errMsg}` })
          uni.showToast({ title: `Request failed (${statusCode}): ${errMsg}`, icon: 'none' })
          throw new Error(`${statusCode}: ${errMsg}`)
        }

        const preview =
          typeof rawData === 'object' && rawData !== null
            ? JSON.stringify(rawData).slice(0, 120) + (JSON.stringify(rawData).length > 120 ? '…' : '')
            : String(rawData).slice(0, 120)
        pushApiLog({ method: methodType, url, status: statusCode, duration, preview })

        // Fashion Rec API returns raw JSON, no { code, data, message } wrapper
        return rawData
      },
      onError: (error, method) => {
        const m = method as unknown as { __debugStart?: number; url?: string; type?: string }
        const duration = m.__debugStart ? Date.now() - m.__debugStart : 0
        pushApiLog({
          method: ((m.type ?? 'GET') as string).toUpperCase(),
          url: m.url ?? '',
          status: 'error',
          duration,
          preview: (error as Error).message,
        })
        console.error('[API]', error)
        throw error
      },
    },
  })

  const axiosLike = {
    baseURL,
    get defaults() {
      return { baseURL }
    },
    async get<T>(url: string, config?: { params?: Record<string, string>; timeout?: number }) {
      const data = await alova
        .Get(url, {
          params: config?.params,
          timeout: config?.timeout ?? timeout,
        })
        .send()
      return { data: data as T }
    },
    async post<T>(url: string, body?: unknown, config?: { headers?: Record<string, string>; timeout?: number }) {
      const data = await alova
        .Post(url, body, {
          headers: config?.headers,
          timeout: config?.timeout ?? timeout,
        })
        .send()
      return { data: data as T }
    },
    async put<T>(url: string, body?: unknown, config?: { headers?: Record<string, string> }) {
      const data = await alova.Put(url, body, { headers: config?.headers }).send()
      return { data: data as T }
    },
    async delete<T>(url: string) {
      const data = await alova.Delete(url).send()
      return { data: data as T }
    },
  }

  return { alova, axiosLike }
}

const api = createFashionApiClient(API_URL, 30000)
const upload = createFashionApiClient(API_URL, 300000)
const longUpload = createFashionApiClient(API_URL, 600000)
const subscription = createFashionApiClient(SUBSCRIPTION_API_URL, 60000)

export const apiClient = api.axiosLike
export const uploadApiClient = upload.axiosLike
export const longUploadApiClient = longUpload.axiosLike
export const subscriptionClient = subscription.axiosLike
