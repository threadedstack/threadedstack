import { ApiService } from '@tdsk/domain'
import type { TApiRequest, TApiResponse } from '@tdsk/domain'
import { env } from './env'

export type ApiResponse<T = unknown> = TApiResponse<T> & {
  limit?: number
  offset?: number
  warning?: string
  message?: string
  overrides?: Record<string, unknown> | null
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
  /** Use path as-is without auto-prefixing /_  (e.g. for /health, /faas/*, /proxy/*) */
  rawPath?: boolean
  /** Fetch timeout in milliseconds (default: 15_000) */
  timeout?: number
  /** Return the raw JSON body without unwrapping { data } envelope (for OpenAI-compat endpoints) */
  rawResponse?: boolean
}

// Lazily-initialized ApiService instances.
// Four variants cover the noAuth × rawPath matrix.
let _client: ApiService | undefined
let _noAuthClient: ApiService | undefined
let _rawClient: ApiService | undefined
let _rawNoAuthClient: ApiService | undefined

function getAuthHeaders(): Record<string, string> {
  const key = env.testApiKey
  return key ? { Authorization: `Bearer ${key}` } : {}
}

function getClient(noAuth: boolean, rawPath: boolean): ApiService {
  if (!noAuth && !rawPath) {
    if (!_client) {
      _client = new ApiService({
        url: env.proxyUrl,
        basePath: '_',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      })
    }
    return _client
  }

  if (noAuth && !rawPath) {
    if (!_noAuthClient) {
      _noAuthClient = new ApiService({
        url: env.proxyUrl,
        basePath: '_',
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return _noAuthClient
  }

  if (!noAuth && rawPath) {
    if (!_rawClient) {
      _rawClient = new ApiService({
        url: env.proxyUrl,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      })
    }
    return _rawClient
  }

  // noAuth && rawPath
  if (!_rawNoAuthClient) {
    _rawNoAuthClient = new ApiService({
      url: env.proxyUrl,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return _rawNoAuthClient
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
  const {
    method = 'GET',
    body,
    headers = {},
    apiKey,
    noAuth = false,
    rawPath = false,
    timeout = 15_000,
    rawResponse = false,
  } = opts

  const client = getClient(noAuth, rawPath)

  // Build the path: for non-rawPath, strip any leading /_/ or /_ prefix since
  // ApiService will prepend the basePath ('_') itself. For rawPath, keep as-is.
  let resolvedPath: string
  if (rawPath) {
    resolvedPath = path
  } else if (path.startsWith('/_')) {
    // Strip leading /_ so ApiService doesn't double-prefix
    resolvedPath = path.slice(2)
  } else {
    resolvedPath = path.startsWith('/') ? path : `/${path}`
  }

  const reqHeaders: Record<string, string> = { ...headers }

  // Per-request apiKey override: inject Authorization header which will merge
  // over the instance header in ApiService.buildHeaders
  if (apiKey) {
    reqHeaders['Authorization'] = `Bearer ${apiKey}`
  }

  const request: TApiRequest = {
    path: resolvedPath,
    data: body as Record<string, any> | string | undefined,
    headers: Object.keys(reqHeaders).length > 0 ? reqHeaders : undefined,
    timeout,
    rawResponse: rawResponse || rawPath,
  }

  let result: TApiResponse<T>
  const lowerMethod = method.toUpperCase()
  if (lowerMethod === `POST`) {
    result = await client.post<T>(request)
  } else if (lowerMethod === `PUT`) {
    result = await client.put<T>(request)
  } else if (lowerMethod === `DELETE`) {
    result = await client.delete<T>(request)
  } else if (lowerMethod === `PATCH`) {
    result = await client.patch<T>(request)
  } else {
    result = await client.get<T>(request)
  }

  return result as ApiResponse<T>
}

/** GET shorthand */
export const get = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'GET' })

/** POST shorthand */
export const post = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'POST', body })

/** PUT shorthand */
export const put = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'PUT', body })

/** DELETE shorthand */
export const del = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'DELETE' })
