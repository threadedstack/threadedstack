import { env } from './env'

export interface ApiResponse<T = unknown> {
  status: number
  ok: boolean
  data: T
}

interface RequestOptions {
  /** HTTP method (default: GET) */
  method?: string
  /** Request body (auto-stringified) */
  body?: unknown
  /** Additional headers */
  headers?: Record<string, string>
  /** Override API key (defaults to env.testApiKey) */
  apiKey?: string
  /** Skip auth entirely — for testing 401 responses */
  noAuth?: boolean
  /** Use path as-is without auto-prefixing /_  (e.g. for /ai/chat) */
  rawPath?: boolean
}

/**
 * Typed fetch wrapper for integration tests.
 *
 * All requests go through the proxy (Caddy → Proxy → Backend).
 * Bearer API key auth is added automatically unless `noAuth: true`.
 *
 * Paths are auto-prefixed with `/_` for admin API routes.
 */
export const api = async <T = unknown>(
  path: string,
  opts: RequestOptions = {}
): Promise<ApiResponse<T>> => {
  const { method = 'GET', body, headers = {}, apiKey, noAuth = false, rawPath = false } = opts

  const fullPath = rawPath || path.startsWith('/_') || path.startsWith('/health')
    ? path
    : `/_${path.startsWith('/') ? '' : '/'}${path}`

  const url = `${env.proxyUrl}${fullPath}`

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (!noAuth) {
    const key = apiKey ?? env.testApiKey
    if (key) {
      reqHeaders['Authorization'] = `Bearer ${key}`
    }
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  let data: T
  try {
    data = await res.json() as T
  } catch {
    data = null as T
  }

  return { status: res.status, ok: res.ok, data }
}

/** GET shorthand */
export const get = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'GET' })

/** POST shorthand */
export const post = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'POST', body })

/** DELETE shorthand */
export const del = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'DELETE' })
