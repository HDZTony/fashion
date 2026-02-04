/**
 * uni.request 封装为 Fetch API 兼容实现。
 * UniApp App 端（Android/iOS）的 WebView 可能没有全局 fetch，Supabase 等库依赖 fetch。
 */
export type UniFetch = typeof fetch

/**
 * 将 uni.request 封装为符合 Fetch API 签名的函数。
 */
export function createUniFetch(): UniFetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method || 'GET').toUpperCase()
    const headers: Record<string, string> = {}

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v })
      }
      else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headers[k] = v })
      }
      else {
        Object.assign(headers, init.headers)
      }
    }

    let body: string | undefined
    if (init?.body != null) {
      body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body)
    }

    return new Promise((resolve, reject) => {
      uni.request({
        url,
        method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT',
        header: headers,
        data: body,
        success: (res) => {
          const response = createResponse(res)
          resolve(response)
        },
        fail: (err) => {
          reject(new Error(err.errMsg || 'Request failed'))
        },
      })
    })
  }
}

function createResponse(res: UniApp.RequestSuccessCallbackResult): Response {
  const headers = new Headers()
  const rawHeaders = res.header as Record<string, string> || {}
  Object.entries(rawHeaders).forEach(([k, v]) => {
    if (v != null)
      headers.set(k, String(v))
  })

  const body = res.data != null ? JSON.stringify(res.data) : ''
  return new Response(body, {
    status: res.statusCode,
    statusText: getStatusText(res.statusCode),
    headers,
  })
}

function getStatusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
  }
  return map[code] || ''
}
