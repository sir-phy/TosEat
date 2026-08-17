export interface ApiResponse<T = any> {
  message: string
  data?: T
  errors?: string[]
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

export const getAccessToken = (): string | null => {
  return localStorage.getItem('gomeal_access_token')
}

export const setAccessToken = (token: string): void => {
  localStorage.setItem('gomeal_access_token', token)
}

export const removeAccessToken = (): void => {
  localStorage.removeItem('gomeal_access_token')
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = endpoint.startsWith('http') ? endpoint : (endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`)

  try {
    const res = await fetch(url, {
      ...options,
      headers
    })

    const data: ApiResponse<T> = await res.json().catch(() => ({
      message: res.statusText || 'Server Error',
      errors: ['PARSE_ERROR']
    }))

    if (!res.ok) {
      const errorMsg = data.message || `Request failed with status ${res.status}`
      console.warn(`[API ${options.method || 'GET'} ${url}] Error:`, errorMsg, data)
      throw new Error(errorMsg)
    }

    return data
  } catch (err: any) {
    console.error(`[API Network Error] ${url}:`, err)
    throw err
  }
}

export const api = {
  get: <T = any>(url: string, headers?: Record<string, string>) =>
    apiRequest<T>(url, { method: 'GET', headers }),

  post: <T = any>(url: string, body?: any, headers?: Record<string, string>) =>
    apiRequest<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers }),

  put: <T = any>(url: string, body?: any, headers?: Record<string, string>) =>
    apiRequest<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, headers }),

  patch: <T = any>(url: string, body?: any, headers?: Record<string, string>) =>
    apiRequest<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, headers }),

  delete: <T = any>(url: string, headers?: Record<string, string>) =>
    apiRequest<T>(url, { method: 'DELETE', headers })
}
