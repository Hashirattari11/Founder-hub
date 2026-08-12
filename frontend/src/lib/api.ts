import { supabase } from './supabase'
import { getErrorMessage } from './errors'
import { API_URL } from './config'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
}

async function parseJson<T>(response: Response): Promise<T> {
  const type = (response.headers.get('content-type') ?? '').toLowerCase()
  if (!type.includes('application/json')) {
    throw new Error('Service temporarily unavailable.')
  }
  return response.json() as Promise<T>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = false, headers, ...rest } = options

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const finalHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  }

  if (auth) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    let token = session?.access_token
    if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      token = refreshed.session?.access_token ?? token
    }
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`
    }
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    throw new Error(getErrorMessage(err, 'network'))
  }

  if (!response.ok) {
    let detail = ''
    try {
      const data = await response.json()
      if (data.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch {
      // ignore parse errors
    }
    const ctx =
      response.status === 401 || response.status === 403
        ? 'permission'
        : response.status === 404
          ? 'notFound'
          : response.status >= 500
            ? 'generic'
            : 'network'
    throw new Error(getErrorMessage(detail || response.status, ctx))
  }

  if (response.status === 204) return undefined as T
  return parseJson<T>(response)
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
}
