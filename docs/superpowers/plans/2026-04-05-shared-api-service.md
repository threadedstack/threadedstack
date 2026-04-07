# Shared ApiService Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared `ApiService` fetch wrapper into `@tdsk/domain` and migrate backend, admin, repl, and integration repos to use it.

**Architecture:** Single `ApiService` class in `domain/src/services/api/` with protected override points (`invoke`, `buildUrl`, `buildHeaders`, `buildBody`, `parseResponse`, `buildError`). Repos subclass for retry/refresh or use the class directly. Supporting utilities (`objToQuery`, `toFormData`) move to domain alongside the service.

**Tech Stack:** TypeScript, native `fetch`, `@tdsk/domain` Exception class, Vitest

**Spec:** `docs/superpowers/specs/2026-04-05-shared-api-service-design.md`

**CRITICAL RULES FOR ALL AGENTS:**
- **NEVER** run `git commit`, `git push`, or any git history mutation. Only `git add`, `git status`, `git diff`, `git log` are allowed.
- **NEVER** leave TODO/FIXME comments in code. Implement everything fully.
- Run `pnpm types` in affected repos after each task to catch type errors.

---

## File Structure

### New files (domain)

| File | Responsibility |
|------|---------------|
| `repos/domain/src/services/api/index.ts` | Barrel export for ApiService, types, utilities |
| `repos/domain/src/services/api/api.types.ts` | `EApiMethod`, `TApiConfig`, `TApiRequest`, `TApiResponse`, `TApiMeta`, `TApiRequestExt` |
| `repos/domain/src/services/api/apiService.ts` | `ApiService` class with protected override points |
| `repos/domain/src/services/api/objToQuery.ts` | Query string builder (moved from backend) |
| `repos/domain/src/services/api/toFormData.ts` | FormData converter (consolidated from backend + admin) |
| `repos/domain/src/services/api/apiService.test.ts` | Unit tests for ApiService |
| `repos/domain/src/services/api/objToQuery.test.ts` | Unit tests for objToQuery (moved from backend) |
| `repos/domain/src/services/api/toFormData.test.ts` | Unit tests for toFormData (moved from backend) |

### Modified files (domain)

| File | Change |
|------|--------|
| `repos/domain/src/services/index.ts` | Replace `export {}` with `export * from './api'` |

### Modified files (backend)

| File | Change |
|------|--------|
| `repos/backend/src/services/api.ts` | Replace `API` class with re-export of `ApiService` from domain |
| `repos/backend/src/services/api.test.ts` | Update imports to use `ApiService` from domain |
| `repos/backend/src/types/api.types.ts` | Remove `EAPIMethod` (use `EApiMethod` from domain), keep repo-specific types |
| `repos/backend/src/utils/api/objToQuery.ts` | Replace with re-export from domain |
| `repos/backend/src/utils/api/toFormData.ts` | Replace with re-export from domain |
| `repos/backend/src/services/email/strategies/resend.ts` | Update `API` → `ApiService` import |

### Modified files (admin)

| File | Change |
|------|--------|
| `repos/admin/src/services/api.ts` | `AdminApiService extends ApiService` from domain |
| `repos/admin/src/services/api.test.ts` | Update imports, test AdminApiService |
| `repos/admin/src/types/api.types.ts` | Remove duplicated types, re-export from domain + add admin-specific types |
| `repos/admin/src/utils/api/objToQuery.tsx` | Replace with re-export from domain |
| `repos/admin/src/utils/api/genFormData.ts` | Replace with re-export from domain (as `toFormData`) |
| `repos/admin/src/utils/errors/ApiError.ts` | Keep as thin wrapper or replace with Exception |

### Modified files (repl)

| File | Change |
|------|--------|
| `repos/repl/src/services/api.ts` | `ReplApiClient extends ApiService` from domain |
| `repos/repl/src/services/api.test.ts` | Update tests for return-style responses |
| `repos/repl/src/services/executor.ts` | Update to handle `{ data, error }` returns |
| `repos/repl/src/services/executor.test.ts` | Update test expectations |
| `repos/repl/src/tasks/agents.ts` | Update call sites for return-style |
| `repos/repl/src/tasks/threads.ts` | Update call sites for return-style |
| `repos/repl/src/tasks/sandboxes.ts` | Update call sites for return-style |
| `repos/repl/src/tasks/ssh.ts` | Update call sites for return-style |
| `repos/repl/src/renderers/chatLogic.ts` | Update call sites for return-style |
| `repos/repl/src/renderers/chatLogic.test.ts` | Update test expectations |
| `repos/repl/src/utils/api/resolveOrg.ts` | Update call site for return-style |

### Modified files (integration)

| File | Change |
|------|--------|
| `repos/integration/src/utils/api-client.ts` | Replace with `ApiService` instance + convenience functions |

---

## Task 1: Create Domain Types

**Files:**
- Create: `repos/domain/src/services/api/api.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// repos/domain/src/services/api/api.types.ts

import type { Exception } from '../../error/exception'

export enum EApiMethod {
  GET = `GET`,
  PUT = `PUT`,
  POST = `POST`,
  PATCH = `PATCH`,
  DELETE = `DELETE`,
}

export type TApiConfig = {
  url: string
  basePath?: string
  headers?: Record<string, string>
  options?: Omit<RequestInit, `body` | `headers` | `method`>
}

export type TApiRequest = Omit<Partial<RequestInit>, `body` | `headers`> & {
  path?: string
  data?: Record<string, any> | string
  form?: boolean
  headers?: Record<string, string>
  responseType?: `json` | `text`
  rawResponse?: boolean
  error?: string
  timeout?: number
}

export type TApiRequestExt = Omit<TApiRequest, `body` | `data`> & {
  url: string
  body?: string | FormData
  method: EApiMethod
}

export type TApiResponse<T = Record<string, any>> = {
  ok: boolean
  status: number
  data?: T
  error?: Exception
}

export type TApiMeta = {
  limit?: number
  offset?: number
  warning?: string
  message?: string
  [key: string]: unknown
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/domain && npx tsc --noEmit src/services/api/api.types.ts`
Expected: No errors

---

## Task 2: Move objToQuery to Domain

**Files:**
- Create: `repos/domain/src/services/api/objToQuery.ts`
- Create: `repos/domain/src/services/api/objToQuery.test.ts`

- [ ] **Step 1: Create objToQuery.ts**

Copy from `repos/backend/src/utils/api/objToQuery.ts` with no changes to logic. The imports stay the same (`@keg-hub/jsutils`):

```typescript
// repos/domain/src/services/api/objToQuery.ts

import { isStr } from '@keg-hub/jsutils/isStr'
import { isNum } from '@keg-hub/jsutils/isNum'
import { isArr } from '@keg-hub/jsutils/isArr'
import { isBool } from '@keg-hub/jsutils/isBool'
import { isColl } from '@keg-hub/jsutils/isColl'
import { exists } from '@keg-hub/jsutils/exists'
import { reduceObj } from '@keg-hub/jsutils/reduceObj'

export type TObjToQueryOpts = {
  array?: `string` | `repeated`
}

const valueToStr = (encodedKey: string, value: any) => {
  const stringVal =
    isStr(value) || isNum(value) || isBool(value)
      ? value
      : isColl(value)
        ? isArr(value)
          ? value.join(',')
          : JSON.stringify(value)
        : null

  return exists(stringVal) ? `${encodedKey}=${encodeURIComponent(stringVal)}` : null
}

const arrToStr = (encodedKey: string, value: Array<string | number | boolean>) => {
  return (
    value.reduce((acc, val) => {
      if (!exists(val)) return acc

      return acc
        ? `${acc}&${encodedKey}=${encodeURIComponent(val)}`
        : `${encodedKey}=${encodeURIComponent(val)}`
    }, ``) || null
  )
}

export const objToQuery = <T extends string>(
  obj: Record<string, any>,
  opts: TObjToQueryOpts = {}
): T => {
  const repeated = (opts?.array || `repeated`) == `repeated`
  return reduceObj(
    obj,
    (key, value, urlStr) => {
      if (!exists(value)) return urlStr

      const encodedKey = encodeURIComponent(key)

      const converted =
        isArr(value) && repeated
          ? arrToStr(encodedKey, value)
          : valueToStr(encodedKey, value)

      if (!exists(converted)) return urlStr

      return urlStr ? `${urlStr}&${converted}` : `?${converted}`
    },
    ''
  ) as T
}
```

- [ ] **Step 2: Create objToQuery.test.ts**

Copy from `repos/backend/src/utils/api/objToQuery.test.ts` — update the import path only:

```typescript
// repos/domain/src/services/api/objToQuery.test.ts

import { describe, it, expect } from 'vitest'
import { objToQuery } from './objToQuery'

// ... rest of test file identical to repos/backend/src/utils/api/objToQuery.test.ts
// All 16 test cases covering: basic, data types, arrays, objects, URL encoding, edge cases
```

- [ ] **Step 3: Run tests**

Run: `cd repos/domain && npx vitest run src/services/api/objToQuery.test.ts`
Expected: 16 tests PASS

---

## Task 3: Move toFormData to Domain

**Files:**
- Create: `repos/domain/src/services/api/toFormData.ts`
- Create: `repos/domain/src/services/api/toFormData.test.ts`

- [ ] **Step 1: Create toFormData.ts**

```typescript
// repos/domain/src/services/api/toFormData.ts

export const toFormData = (data: Record<string, any>): FormData | undefined => {
  if (!data) return undefined

  return Object.entries(data).reduce((form, [key, value]) => {
    form.set(key, typeof value === `object` ? JSON.stringify(value) : value)

    return form
  }, new FormData())
}
```

- [ ] **Step 2: Create toFormData.test.ts**

Copy from `repos/backend/src/utils/api/toFormData.test.ts` — update import path only:

```typescript
// repos/domain/src/services/api/toFormData.test.ts

import { describe, it, expect } from 'vitest'
import { toFormData } from './toFormData'

// ... rest of test file identical to repos/backend/src/utils/api/toFormData.test.ts
// All 8 test cases covering: falsy data, simple pairs, empty object, objects, arrays, mixed, special chars, nested, duplicates
```

- [ ] **Step 3: Run tests**

Run: `cd repos/domain && npx vitest run src/services/api/toFormData.test.ts`
Expected: 8 tests PASS

---

## Task 4: Implement ApiService Class

**Files:**
- Create: `repos/domain/src/services/api/apiService.ts`

- [ ] **Step 1: Write the ApiService class**

```typescript
// repos/domain/src/services/api/apiService.ts

import type {
  TApiConfig,
  TApiRequest,
  TApiResponse,
  TApiRequestExt,
} from './api.types'

import { EApiMethod } from './api.types'
import { Exception } from '../../error/exception'
import { isObj } from '@keg-hub/jsutils/isObj'
import { objToQuery } from './objToQuery'
import { toFormData } from './toFormData'

export class ApiService {
  url: string
  basePath: string
  headers: Record<string, string>
  options: Omit<RequestInit, `body` | `headers` | `method`>

  constructor(config: TApiConfig) {
    this.url = config.url
    this.basePath = config.basePath ?? ``
    this.headers = { ...config.headers }
    this.options = { ...config.options }
  }

  // --- Mutable header management ---

  setHeaders = (update: Record<string, string>, merge: boolean = true) => {
    this.headers = merge
      ? { ...this.headers, ...update }
      : { ...update }
  }

  setBearer = (token: string) => {
    this.headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
    }
  }

  clearBearer = () => {
    const { Authorization, ...rest } = this.headers
    this.headers = rest
  }

  // --- Protected override points ---

  protected buildUrl(
    path: string = ``,
    params?: string | Record<string, any>
  ): string {
    const baseClean = this.url.replace(/\/$/, ``)
    const pathParts = [baseClean]

    if (this.basePath) pathParts.push(this.basePath)
    if (path) pathParts.push(path.replace(/^\//, ``))

    const built = pathParts.join(`/`)

    if (!params) return built
    if (isObj(params)) return `${built}${objToQuery(params)}`
    return `${built}?${(params as string).replace(/^\?/, ``)}`
  }

  protected buildHeaders(
    requestHeaders?: Record<string, string>
  ): Record<string, string> {
    return { ...this.headers, ...requestHeaders }
  }

  protected buildBody(
    data: TApiRequest[`data`],
    form?: boolean
  ): string | FormData | undefined {
    if (data === undefined || data === null) return undefined
    if (form) return toFormData(data as Record<string, any>)
    return JSON.stringify(data)
  }

  protected buildError(
    message: string,
    status: number,
    text?: string
  ): Exception {
    const statusText = text ? `Status: ${status} - ${text}` : ``
    const msg = [message, statusText].filter(Boolean).join(`\n`)
    return new Exception(status, msg)
  }

  protected async parseResponse<T>(
    res: Response,
    opts: TApiRequest
  ): Promise<TApiResponse<T>> {
    if (res.status >= 400) {
      const text = res.text ? await res.text().catch(() => res.statusText || `Request failed`) : res.statusText || `Request failed`
      return {
        ok: false,
        status: res.status,
        error: this.buildError(opts.error || ``, res.status, text),
      }
    }

    const parsed = opts.responseType === `text`
      ? await res.text()
      : await res.json()

    if (opts.rawResponse || !isObj(parsed) || !(`data` in parsed)) {
      return { ok: true, status: res.status, data: parsed as T }
    }

    const { data, ...meta } = parsed
    return { ok: true, status: res.status, data: data as T, ...meta }
  }

  protected async invoke<T>(
    opts: TApiRequest & { method: EApiMethod }
  ): Promise<TApiResponse<T>> {
    const { data, path, form, method, headers: reqHeaders, timeout, ...rest } = opts
    const isGet = method === EApiMethod.GET

    const url = this.buildUrl(path, isGet ? data : undefined)
    const headers = this.buildHeaders(reqHeaders)
    const body = isGet ? undefined : this.buildBody(data, form)

    const fetchOpts: RequestInit = {
      ...this.options,
      ...rest,
      method,
      headers,
    }

    if (body !== undefined) fetchOpts.body = body
    if (timeout) fetchOpts.signal = AbortSignal.timeout(timeout)

    try {
      const res = await fetch(url, fetchOpts)
      return await this.parseResponse<T>(res, opts)
    } catch (error: any) {
      return {
        ok: false,
        status: 0,
        error: this.buildError(error.message, 0),
      }
    }
  }

  // --- HTTP method shortcuts ---

  get = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.GET })
  }

  post = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.POST })
  }

  put = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.PUT })
  }

  delete = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.DELETE })
  }

  patch = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.PATCH })
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd repos/domain && pnpm types`
Expected: No type errors

---

## Task 5: Write ApiService Unit Tests

**Files:**
- Create: `repos/domain/src/services/api/apiService.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// repos/domain/src/services/api/apiService.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiService } from './apiService'
import { EApiMethod } from './api.types'
import { Exception } from '../../error/exception'

const mockFetch = vi.fn()
global.fetch = mockFetch

global.FormData = class FormData {
  private data: Map<string, any> = new Map()
  set(key: string, value: any) { this.data.set(key, value) }
  get(key: string) { return this.data.get(key) }
  append(key: string, value: any) { this.data.set(key, value) }
  keys() { return this.data.keys() }
  entries() { return this.data.entries() }
} as any

describe(`ApiService`, () => {
  let api: ApiService
  const baseUrl = `https://api.example.com`
  const defaultHeaders = { [`Content-Type`]: `application/json` }

  beforeEach(() => {
    api = new ApiService({
      url: baseUrl,
      headers: defaultHeaders,
    })
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe(`constructor`, () => {
    it(`should initialize with url and headers`, () => {
      expect(api.url).toBe(baseUrl)
      expect(api.headers).toEqual(defaultHeaders)
      expect(api.basePath).toBe(``)
    })

    it(`should initialize with basePath`, () => {
      const svc = new ApiService({ url: baseUrl, basePath: `_` })
      expect(svc.basePath).toBe(`_`)
    })

    it(`should default to empty headers when none provided`, () => {
      const svc = new ApiService({ url: baseUrl })
      expect(svc.headers).toEqual({})
    })
  })

  describe(`setHeaders`, () => {
    it(`should merge headers by default`, () => {
      api.setHeaders({ [`X-Custom`]: `value` })
      expect(api.headers).toEqual({ ...defaultHeaders, [`X-Custom`]: `value` })
    })

    it(`should replace headers when merge is false`, () => {
      api.setHeaders({ [`X-Custom`]: `value` }, false)
      expect(api.headers).toEqual({ [`X-Custom`]: `value` })
    })
  })

  describe(`setBearer / clearBearer`, () => {
    it(`should set Authorization header`, () => {
      api.setBearer(`token123`)
      expect(api.headers.Authorization).toBe(`Bearer token123`)
    })

    it(`should preserve existing headers when setting bearer`, () => {
      api.setBearer(`token123`)
      expect(api.headers[`Content-Type`]).toBe(`application/json`)
    })

    it(`should remove Authorization header`, () => {
      api.setBearer(`token123`)
      api.clearBearer()
      expect(api.headers.Authorization).toBeUndefined()
      expect(api.headers[`Content-Type`]).toBe(`application/json`)
    })

    it(`should be safe to call clearBearer when no bearer exists`, () => {
      api.clearBearer()
      expect(api.headers).toEqual(defaultHeaders)
    })
  })

  describe(`GET requests`, () => {
    it(`should make GET request and return data`, async () => {
      const responseData = { data: { id: 1, name: `Test` } }
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(responseData),
        text: () => Promise.resolve(JSON.stringify(responseData)),
      })

      const result = await api.get({ path: `/users` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({ method: EApiMethod.GET, headers: defaultHeaders })
      )
      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toEqual({ id: 1, name: `Test` })
    })

    it(`should append query params from data on GET`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      })

      await api.get({ path: `/users`, data: { limit: 10, page: 1 } })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users?limit=10&page=1`,
        expect.any(Object)
      )
    })

    it(`should handle text responseType`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(`plain text`),
      })

      const result = await api.get({ path: `/text`, responseType: `text` })
      expect(result.data).toBe(`plain text`)
    })

    it(`should return raw response when rawResponse is true`, async () => {
      const raw = { data: { id: 1 }, limit: 10, offset: 0 }
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(raw),
      })

      const result = await api.get({ path: `/users`, rawResponse: true })
      expect(result.data).toEqual(raw)
    })
  })

  describe(`POST requests`, () => {
    it(`should send JSON body`, async () => {
      const body = { name: `New User` }
      mockFetch.mockResolvedValueOnce({
        status: 201,
        json: () => Promise.resolve({ data: { id: 1, ...body } }),
      })

      const result = await api.post({ path: `/users`, data: body })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({
          method: EApiMethod.POST,
          body: JSON.stringify(body),
        })
      )
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ id: 1, ...body })
    })

    it(`should send FormData when form is true`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: { success: true } }),
      })

      await api.post({ path: `/upload`, data: { file: `content` }, form: true })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/upload`,
        expect.objectContaining({
          method: EApiMethod.POST,
          body: expect.any(FormData),
        })
      )
    })
  })

  describe(`PUT requests`, () => {
    it(`should make PUT request`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: { id: 1, name: `Updated` } }),
      })

      const result = await api.put({ path: `/users/1`, data: { name: `Updated` } })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ id: 1, name: `Updated` })
    })
  })

  describe(`DELETE requests`, () => {
    it(`should make DELETE request`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 204,
        json: () => Promise.resolve({}),
      })

      const result = await api.delete({ path: `/users/1` })
      expect(result.status).toBe(204)
    })
  })

  describe(`PATCH requests`, () => {
    it(`should make PATCH request`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: { patched: true } }),
      })

      const result = await api.patch({ path: `/users/1`, data: { name: `Patched` } })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ patched: true })
    })
  })

  describe(`basePath`, () => {
    it(`should prepend basePath to all requests`, async () => {
      const svc = new ApiService({ url: baseUrl, basePath: `_` })
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await svc.get({ path: `/orgs` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/_/orgs`,
        expect.any(Object)
      )
    })

    it(`should handle empty basePath`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.get({ path: `/orgs` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/orgs`,
        expect.any(Object)
      )
    })
  })

  describe(`envelope unwrapping`, () => {
    it(`should unwrap { data } envelope by default`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: { id: 1 }, limit: 10, offset: 0 }),
      })

      const result = await api.get({ path: `/items` })
      expect(result.data).toEqual({ id: 1 })
    })

    it(`should pass through non-envelope responses`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ id: 1, name: `direct` }),
      })

      const result = await api.get({ path: `/external` })
      expect(result.data).toEqual({ id: 1, name: `direct` })
    })
  })

  describe(`error handling`, () => {
    it(`should return error for HTTP 4xx/5xx`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        statusText: `Not Found`,
        text: () => Promise.resolve(`User not found`),
      })

      const result = await api.get({ path: `/users/999`, error: `Failed to fetch user` })

      expect(result.ok).toBe(false)
      expect(result.status).toBe(404)
      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.status).toBe(404)
      expect(result.error?.message).toContain(`Failed to fetch user`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error for network failures`, async () => {
      mockFetch.mockRejectedValueOnce(new Error(`Network error`))

      const result = await api.get({ path: `/users` })

      expect(result.ok).toBe(false)
      expect(result.status).toBe(0)
      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.message).toBe(`Network error`)
    })

    it(`should return error for JSON parse failures`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.reject(new Error(`Invalid JSON`)),
        text: () => Promise.resolve(`not json`),
      })

      const result = await api.get({ path: `/bad-json` })
      expect(result.ok).toBe(false)
      expect(result.error).toBeInstanceOf(Exception)
    })
  })

  describe(`timeout`, () => {
    it(`should apply AbortSignal.timeout when timeout option is set`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.get({ path: `/slow`, timeout: 5000 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      )
    })
  })

  describe(`header merging`, () => {
    it(`should merge request headers with instance headers`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.get({ path: `/users`, headers: { [`X-Custom`]: `value` } })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { ...defaultHeaders, [`X-Custom`]: `value` },
        })
      )
    })

    it(`should allow request headers to override instance headers`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.post({
        path: `/users`,
        data: `text`,
        headers: { [`Content-Type`]: `text/plain` },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { [`Content-Type`]: `text/plain` },
        })
      )
    })
  })

  describe(`URL building`, () => {
    it(`should strip trailing slash from base URL`, async () => {
      const svc = new ApiService({ url: `https://api.example.com/` })
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await svc.get({ path: `/test` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/test`,
        expect.any(Object)
      )
    })

    it(`should handle string query params`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.get({ path: `/users`, data: `limit=10&page=1` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users?limit=10&page=1`,
        expect.any(Object)
      )
    })

    it(`should handle no path`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.get({})

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com`,
        expect.any(Object)
      )
    })
  })

  describe(`subclass override`, () => {
    it(`should allow invoke to be overridden for retry logic`, async () => {
      let callCount = 0

      class RetryApiService extends ApiService {
        protected async invoke<T>(opts: any) {
          const result = await super.invoke<T>(opts)
          if (!result.ok && callCount < 1) {
            callCount++
            return super.invoke<T>(opts)
          }
          return result
        }
      }

      const retrySvc = new RetryApiService({ url: baseUrl })

      mockFetch
        .mockResolvedValueOnce({
          status: 500,
          statusText: `Server Error`,
          text: () => Promise.resolve(`error`),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({ data: { recovered: true } }),
        })

      const result = await retrySvc.get({ path: `/flaky` })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ recovered: true })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
```

- [ ] **Step 2: Run all domain api tests**

Run: `cd repos/domain && npx vitest run src/services/api/`
Expected: All tests PASS (apiService, objToQuery, toFormData)

---

## Task 6: Wire Up Domain Barrel Exports

**Files:**
- Create: `repos/domain/src/services/api/index.ts`
- Modify: `repos/domain/src/services/index.ts`

- [ ] **Step 1: Create the barrel export**

```typescript
// repos/domain/src/services/api/index.ts

export { ApiService } from './apiService'
export { objToQuery } from './objToQuery'
export { toFormData } from './toFormData'
export type { TObjToQueryOpts } from './objToQuery'

export {
  EApiMethod,
  type TApiConfig,
  type TApiRequest,
  type TApiRequestExt,
  type TApiResponse,
  type TApiMeta,
} from './api.types'
```

- [ ] **Step 2: Update services barrel**

Replace the contents of `repos/domain/src/services/index.ts`:

```typescript
// repos/domain/src/services/index.ts

export * from './api'
```

- [ ] **Step 3: Verify full domain types compile**

Run: `cd repos/domain && pnpm types`
Expected: No errors

- [ ] **Step 4: Run all domain tests**

Run: `cd repos/domain && pnpm test`
Expected: All tests PASS including new api service tests

---

## Task 7: Migrate Backend

**Files:**
- Modify: `repos/backend/src/services/api.ts`
- Modify: `repos/backend/src/services/api.test.ts`
- Modify: `repos/backend/src/types/api.types.ts`
- Modify: `repos/backend/src/utils/api/objToQuery.ts`
- Modify: `repos/backend/src/utils/api/toFormData.ts`
- Modify: `repos/backend/src/services/email/strategies/resend.ts`

The backend's `API` class is used in exactly one place: `resend.ts`. The migration strategy is:

1. Replace the backend `API` class with a re-export of `ApiService` (aliased as `API` for backward compat)
2. Replace `objToQuery` and `toFormData` with re-exports from domain
3. Update `resend.ts` import
4. Update types to use domain's `EApiMethod`

- [ ] **Step 1: Replace backend API class**

Replace `repos/backend/src/services/api.ts` with:

```typescript
// repos/backend/src/services/api.ts

// Re-export shared ApiService from domain as API for backward compatibility
export { ApiService as API } from '@tdsk/domain'
```

- [ ] **Step 2: Update backend types**

Replace `repos/backend/src/types/api.types.ts` — remove `EAPIMethod` enum, re-export from domain, keep backend-specific types:

```typescript
// repos/backend/src/types/api.types.ts

import type { Exception } from '@tdsk/domain'

// Re-export from domain for backward compat
export { EApiMethod as EAPIMethod } from '@tdsk/domain'

export type TFormData = Record<string, any>

export type TFetchMethod = Omit<Partial<RequestInit>, `body` | `headers`> & {
  error?: string
  path?: string
  form?: boolean
  responseType?: `json` | `text`
  headers?: Record<string, string>
  data?: string | Record<string, any>
}

export type TFetchOpts = TFetchMethod & {
  url?: string
  method: `GET` | `PUT` | `POST` | `PATCH` | `DELETE`
}

export type TFetchData = Record<string, any>

export type TFetchResp<T extends TFetchData = TFetchData> = {
  error?: Exception
  data?: T
}
```

- [ ] **Step 3: Replace utility re-exports**

Replace `repos/backend/src/utils/api/objToQuery.ts`:

```typescript
export { objToQuery, type TObjToQueryOpts } from '@tdsk/domain'
```

Replace `repos/backend/src/utils/api/toFormData.ts`:

```typescript
export { toFormData } from '@tdsk/domain'
```

- [ ] **Step 4: Update resend.ts**

In `repos/backend/src/services/email/strategies/resend.ts`, change line 3:

```typescript
// Before:
import { API } from '@TBE/services/api'

// After:
import { ApiService } from '@tdsk/domain'
```

And update the constructor at line 21:

```typescript
// Before:
this.#api = new API({

// After:
this.#api = new ApiService({
```

Note: `resend.ts` uses `this.#api.post({ data: payload })` which returns `{ data, error }`. The new `ApiService` returns `{ ok, status, data, error }` — the destructuring `const { data, error } = ...` still works because the extra fields are just ignored.

- [ ] **Step 5: Update backend API tests**

Replace `repos/backend/src/services/api.test.ts` — import `ApiService` from domain instead of local `API`:

```typescript
// repos/backend/src/services/api.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiService } from '@tdsk/domain'
import { EApiMethod } from '@tdsk/domain'
import { Exception } from '@tdsk/domain'

const mockFetch = vi.fn()
global.fetch = mockFetch

global.FormData = class FormData {
  private data: Map<string, any> = new Map()
  set(key: string, value: any) { this.data.set(key, value) }
  get(key: string) { return this.data.get(key) }
  append(key: string, value: any) { this.data.set(key, value) }
} as any

describe(`ApiService (backend)`, () => {
  let api: ApiService
  const baseUrl = `https://api.example.com`
  const defaultHeaders = { [`Content-Type`]: `application/json` }

  beforeEach(() => {
    api = new ApiService({
      url: baseUrl,
      headers: defaultHeaders,
    })
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe(`constructor`, () => {
    it(`should initialize with base URL and headers`, () => {
      expect(api.url).toBe(baseUrl)
      expect(api.headers).toEqual(defaultHeaders)
    })

    it(`should handle initialization without headers`, () => {
      const svc = new ApiService({ url: baseUrl })
      expect(svc.url).toBe(baseUrl)
      expect(svc.headers).toEqual({})
    })
  })

  describe(`GET requests`, () => {
    it(`should make GET request successfully`, async () => {
      const responseData = { data: { id: 1, name: `Test` } }
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve(responseData),
      })

      const result = await api.get({ path: `/users` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({
          method: EApiMethod.GET,
          headers: defaultHeaders,
        })
      )
      expect(result.data).toEqual({ id: 1, name: `Test` })
      expect(result.error).toBeUndefined()
    })

    it(`should handle GET with query parameters`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: { results: [] } }),
      })

      await api.get({ path: `/users`, data: { limit: 10, page: 1 } })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users?limit=10&page=1`,
        expect.objectContaining({ method: EApiMethod.GET })
      )
    })

    it(`should handle text response`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(`Plain text response`),
      })

      const result = await api.get({ path: `/text`, responseType: `text` })
      expect(result.data).toBe(`Plain text response`)
    })
  })

  describe(`POST requests`, () => {
    it(`should make POST with JSON data`, async () => {
      const requestData = { name: `New User` }
      mockFetch.mockResolvedValueOnce({
        status: 201,
        json: () => Promise.resolve({ data: { id: 1, ...requestData } }),
      })

      const result = await api.post({ path: `/users`, data: requestData })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users`,
        expect.objectContaining({
          method: EApiMethod.POST,
          body: JSON.stringify(requestData),
          headers: defaultHeaders,
        })
      )
      expect(result.data).toEqual({ id: 1, ...requestData })
    })

    it(`should make POST with FormData`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: { success: true } }),
      })

      await api.post({ path: `/upload`, data: { file: `content` }, form: true })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/upload`,
        expect.objectContaining({
          method: EApiMethod.POST,
          body: expect.any(FormData),
        })
      )
    })
  })

  describe(`error handling`, () => {
    it(`should handle HTTP error responses`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        statusText: `Not Found`,
        text: () => Promise.resolve(`User not found`),
      })

      const result = await api.get({ path: `/users/999`, error: `Failed to fetch user` })

      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.status).toBe(404)
      expect(result.error?.message).toContain(`Failed to fetch user`)
      expect(result.data).toBeUndefined()
    })

    it(`should handle network errors`, async () => {
      mockFetch.mockRejectedValueOnce(new Error(`Network error`))

      const result = await api.get({ path: `/users` })

      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.message).toBe(`Network error`)
    })
  })

  describe(`URL building`, () => {
    it(`should strip trailing slashes`, async () => {
      const svc = new ApiService({ url: `https://custom.api.com/` })
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await svc.get({ path: `/test` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://custom.api.com/test`,
        expect.any(Object)
      )
    })

    it(`should handle string query params`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.get({ path: `/users`, data: `limit=10&page=1` })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/users?limit=10&page=1`,
        expect.any(Object)
      )
    })
  })

  describe(`headers handling`, () => {
    it(`should merge request headers with defaults`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.get({ path: `/users`, headers: { [`X-Custom`]: `value` } })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { ...defaultHeaders, [`X-Custom`]: `value` },
        })
      )
    })

    it(`should allow request headers to override defaults`, async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: () => Promise.resolve({ data: {} }),
      })

      await api.post({
        path: `/users`,
        data: `text data`,
        headers: { [`Content-Type`]: `text/plain` },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { [`Content-Type`]: `text/plain` },
        })
      )
    })
  })
})
```

- [ ] **Step 6: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests PASS

- [ ] **Step 7: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: No type errors

---

## Task 8: Migrate Admin — Create AdminApiService

**Files:**
- Modify: `repos/admin/src/services/api.ts`
- Modify: `repos/admin/src/services/api.test.ts`
- Modify: `repos/admin/src/types/api.types.ts`
- Modify: `repos/admin/src/utils/api/objToQuery.tsx`
- Modify: `repos/admin/src/utils/api/genFormData.ts`
- Modify: `repos/admin/src/utils/errors/ApiError.ts`

The admin has 23+ services extending `BaseApi` that use `this.api.get(...)`, `this.api.post(...)`, etc. The key constraint: `BaseApi` and `apiService` singleton must keep working so those 23+ files need zero changes.

Strategy:
1. `AdminApiService extends ApiService` — adds `bearer()`, 401 retry via `invoke` override, React Query `get` override
2. `apiService` singleton stays, but is now an `AdminApiService` instance
3. `BaseApi` stays, references the singleton
4. Admin-specific utilities become re-exports from domain

- [ ] **Step 1: Update admin types**

Replace `repos/admin/src/types/api.types.ts` — remove duplicated types, keep admin-specific ones:

```typescript
// repos/admin/src/types/api.types.ts

import type { TApiRequest, TApiResponse } from '@tdsk/domain'
import type { TCacheQueryOpts } from '@TAF/types/query.types'

// Re-export from domain for backward compat with existing admin code
export { EApiMethod as EAPIMethod, type TApiResponse as TApiRes } from '@tdsk/domain'

export type Payload = FormData | any
export type TApiData = Record<string, any>

export type TApiItems<T extends TApiData = TApiData> = {
  items: T[]
}

// Admin-specific request type extends domain's with React Query fields
export type TApiReq<D extends TApiData = TApiData> = TApiRequest & {
  data?: D
  url?: string
  id?: string | number
} & TCacheQueryOpts

export type TApiReqEx = Omit<TApiReq, `body` | `data`> & {
  body?: string | FormData
}

export type TFetchOpts = Omit<Partial<Request>, `body`> & {
  body?: string | FormData
}

type TApiOpts = {
  headers?: Record<string, string>
}

export type TApiService = {
  url?: string
  path?: string
  token?: string
  options?: TApiOpts
}

export type TAuthData = {
  session: { token: string }
  user: { id: string }
}
```

- [ ] **Step 2: Replace utility files with re-exports**

Replace `repos/admin/src/utils/api/objToQuery.tsx`:

```typescript
export { objToQuery, type TObjToQueryOpts } from '@tdsk/domain'
```

Replace `repos/admin/src/utils/api/genFormData.ts`:

```typescript
export { toFormData as genFormData } from '@tdsk/domain'
```

- [ ] **Step 3: Update ApiError to extend Exception**

Replace `repos/admin/src/utils/errors/ApiError.ts`:

```typescript
import { Exception } from '@tdsk/domain'
import { toNum } from '@keg-hub/jsutils/toNum'
import { isStr } from '@keg-hub/jsutils/isStr'

export class ApiError extends Exception {
  name = `ApiError`

  constructor(msg: string | Error, status: string | number) {
    const isErr = !isStr(msg)
    const message = isErr ? (msg as Error).message : msg as string
    super(toNum(status), message)

    if (isErr) this.stack = (msg as Error).stack
  }
}
```

- [ ] **Step 4: Rewrite admin api.ts as AdminApiService**

Replace `repos/admin/src/services/api.ts`:

```typescript
// repos/admin/src/services/api.ts

import type {
  TApiReq,
  TApiData,
  TAuthData,
  TApiService,
} from '@TAF/types'

import { toast } from 'sonner'
import { ApiService, type TApiResponse } from '@tdsk/domain'
import { query } from '@TAF/services/query'
import { limbo } from '@keg-hub/jsutils/limbo'
import { isStr } from '@keg-hub/jsutils/isStr'
import { apiUrl } from '@TAF/utils/api/apiUrl'
import { authClient } from '@TAF/services/auth'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { ApiError } from '@TAF/utils/errors/ApiError'
import { deepMerge } from '@keg-hub/jsutils/deepMerge'
import { tokenRefresh } from '@TAF/services/tokenRefresh'
import { EApiMethod } from '@tdsk/domain'

export class AdminApiService extends ApiService {
  path?: string = `_`
  mock: typeof fetch

  constructor(cfg: TApiService = emptyObj) {
    super({
      url: ``,
      headers: {
        [`Accept`]: `application/json`,
        [`Content-Type`]: `application/json`,
      },
    })
    this.configure(cfg)
  }

  configure = (cfg: TApiService = emptyObj) => {
    const { url, path, options = {} } = cfg

    if (path) this.path = path
    this.url = apiUrl({ url })
    if (options.headers) this.setHeaders(options.headers)
  }

  bearer = async (auth?: TAuthData) => {
    if (!auth) {
      const { data } = await authClient.getSession()
      if (!data?.session?.token) return
      auth = data as TAuthData
    }

    if (!auth?.session?.token) {
      this.clearBearer()
      return
    }

    this.setBearer(auth.session.token)
  }

  // Override buildUrl to use this.path instead of this.basePath
  protected buildUrl(
    path: string = ``,
    params?: string | Record<string, any>
  ): string {
    let base = this.url.replace(/\/$/, ``)
    if (this.path) base = `${base}/${this.path}`

    const pathClean = path ? path.replace(/^\//, ``) : ``
    const built = pathClean ? `${base}/${pathClean}` : base

    if (!params) return built
    const { isObj } = require(`@keg-hub/jsutils/isObj`)
    const { objToQuery } = require(`@tdsk/domain`)
    if (isObj(params)) return `${built}${objToQuery(params)}`
    return `${built}?${(params as string).replace(/^\?/, ``)}`
  }

  // Override invoke to add 401 retry
  protected async invoke<T>(
    opts: TApiReq & { method: EApiMethod }
  ): Promise<TApiResponse<T>> {
    // Use mock fetch if set (for testing)
    const origFetch = globalThis.fetch
    if (this.mock) globalThis.fetch = this.mock

    try {
      const result = await super.invoke<T>(opts)

      if (result.error && result.status === 401) {
        const refreshed = await tokenRefresh.refreshAndRetry()
        if (refreshed) return super.invoke<T>(opts)
      }

      return result
    } finally {
      if (this.mock) globalThis.fetch = origFetch
    }
  }

  // Override get to integrate React Query
  get = async <D extends TApiData = TApiData>(opts: TApiReq): Promise<TApiResponse<D>> => {
    const { queryKey, staleTime, refetchInterval, ...rest } = opts

    const [error, data] = await limbo<D, ApiError>(
      query.fetch(
        query.options({
          queryKey,
          staleTime,
          refetchInterval,
          queryFn: async () => {
            const resp = await this.invoke<D>({ ...rest, method: EApiMethod.GET })
            if (resp.error) throw resp.error
            return resp.data
          },
        })
      )
    )

    return error
      ? { ok: false, status: error.status || 0, data, error }
      : { ok: true, status: 200, data }
  }

  // Convenience alias — admin code calls apiService.fetch()
  fetch = async <R extends TApiData = TApiData>(opts: TApiReq): Promise<TApiResponse<R>> => {
    const method = opts.method || EApiMethod.GET
    return this.invoke<R>({ ...opts, method: method as EApiMethod })
  }
}

// Keep backward-compatible exports
export { AdminApiService as ApiService }
export const apiService = new AdminApiService()

export class BaseApi {
  api: typeof apiService

  constructor() {
    this.api = apiService
  }

  _onError = async (error?: Error | string, title?: string) => {
    if (!error) return
    const message = isStr(error) ? error : error?.message
    toast.error(title || `API Error`, { description: message })
    console.warn(message)
  }
}
```

- [ ] **Step 5: Update admin API tests**

Replace `repos/admin/src/services/api.test.ts` — test `AdminApiService`:

```typescript
// repos/admin/src/services/api.test.ts

import { AdminApiService } from './api'
import { ApiError } from '@TAF/utils/errors/ApiError'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRefreshAndRetry = vi.fn()

vi.mock(`@TAF/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: (...args: any[]) => mockRefreshAndRetry(...args),
  },
}))

vi.mock(`@TAF/services/auth`, () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { token: `test` }, user: { id: `u1` } },
    }),
  },
}))

vi.mock(`@TAF/utils/api/apiUrl`, () => ({
  apiUrl: () => `http://test.local`,
}))

vi.mock(`@TAF/services/query`, () => ({
  query: {
    fetch: vi.fn(),
    options: vi.fn((o: any) => o),
  },
}))

describe(`AdminApiService`, () => {
  let service: AdminApiService
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AdminApiService({ url: `http://test.local` })
    mockFetch = vi.fn()
    service.mock = mockFetch as any
  })

  const makeResponse = (status: number, body: any = {}) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status === 401 ? `Unauthorized` : `OK`,
      headers: { [`Content-Type`]: `application/json` },
    })

  describe(`fetch() - 401 retry`, () => {
    it(`should return result directly for successful responses`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `1` } }))

      const result = await service.fetch({ path: `test` })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ id: `1` })
      expect(mockRefreshAndRetry).not.toHaveBeenCalled()
    })

    it(`should return result directly for non-401 errors`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(403, { error: `Forbidden` }))

      const result = await service.fetch({ path: `test` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(403)
      expect(mockRefreshAndRetry).not.toHaveBeenCalled()
    })

    it(`should call tokenRefresh.refreshAndRetry() on 401`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
      mockRefreshAndRetry.mockResolvedValueOnce(false)

      await service.fetch({ path: `test` })
      expect(mockRefreshAndRetry).toHaveBeenCalledOnce()
    })

    it(`should retry the request once after successful refresh`, async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
        .mockResolvedValueOnce(makeResponse(200, { data: { id: `retried` } }))
      mockRefreshAndRetry.mockResolvedValueOnce(true)

      const result = await service.fetch({ path: `test` })
      expect(result.data).toEqual({ id: `retried` })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it(`should return original 401 error when refresh fails`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
      mockRefreshAndRetry.mockResolvedValueOnce(false)

      const result = await service.fetch({ path: `test` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe(`clearBearer()`, () => {
    it(`should remove Authorization header`, () => {
      service.setBearer(`test`)
      service.clearBearer()
      expect(service.headers.Authorization).toBeUndefined()
    })

    it(`should be safe to call when no Authorization header exists`, () => {
      service.clearBearer()
      expect(service.headers.Authorization).toBeUndefined()
    })
  })
})
```

- [ ] **Step 6: Run admin tests**

Run: `cd repos/admin && pnpm test`
Expected: All tests PASS

- [ ] **Step 7: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: No type errors

---

## Task 9: Migrate Repl — Create ReplApiClient

**Files:**
- Modify: `repos/repl/src/services/api.ts`
- Modify: `repos/repl/src/services/api.test.ts`

The repl's `ApiClient` has 7 consumers: executor, 4 task files, chatLogic, resolveOrg. All currently use throw-style error handling. The migration changes to return-style (`{ data, error }`).

Strategy:
1. `ReplApiClient extends ApiService` — override `invoke` for exponential backoff retry
2. Keep domain-specific methods (`listOrgs`, `listAgents`, etc.) on the subclass, but change them to return `TApiResponse` instead of throwing
3. Update all call sites from try/catch to `{ data, error }` destructuring

- [ ] **Step 1: Rewrite repl api.ts**

Replace `repos/repl/src/services/api.ts`:

```typescript
// repos/repl/src/services/api.ts

import type { AuthManager } from '@TRL/services/auth'
import type { TSessionInfo, TProviderInfo } from '@TRL/types'

import { ApiService, EApiMethod, type TApiResponse, type TApiRequest } from '@tdsk/domain'
import { MaxRetries, RetryDelays } from '@TRL/constants'
import { Agent, Thread, Message, Organization } from '@tdsk/domain'

export class ReplApiClient extends ApiService {
  #auth: AuthManager

  constructor(auth: AuthManager) {
    const creds = auth.creds()
    super({
      url: creds?.proxyUrl || ``,
      basePath: `_`,
      headers: {
        Accept: `application/json`,
        ...(creds?.apiKey ? { Authorization: `Bearer ${creds.apiKey}` } : {}),
      },
    })
    this.#auth = auth
  }

  #ensureAuth() {
    const creds = this.#auth.creds()
    if (!creds) throw new Error(`Not logged in. Run "tsa login" first.`)

    // Sync url and bearer in case creds changed since construction
    this.url = creds.proxyUrl
    this.setBearer(creds.apiKey)
    if (creds.insecure) process.env[`NODE_TLS_REJECT_UNAUTHORIZED`] = `0`

    return creds
  }

  get proxyUrl(): string {
    const creds = this.#auth.creds()
    if (!creds) throw new Error(`Not logged in. Run "tsa login" first.`)
    return creds.proxyUrl
  }

  #isRetryableError(error: Error): boolean {
    if ('code' in error) {
      const code = (error as any).code
      if (code === `ECONNREFUSED` || code === `ETIMEDOUT` || code === `ENOTFOUND`)
        return true
    }
    return [429, 500, 502, 503].some((s) => error.message.includes(`(${s})`))
  }

  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Override invoke to add exponential backoff retry
  protected async invoke<T>(
    opts: TApiRequest & { method: EApiMethod }
  ): Promise<TApiResponse<T>> {
    this.#ensureAuth()

    let lastResult: TApiResponse<T> | undefined
    for (let attempt = 0; attempt <= MaxRetries; attempt++) {
      lastResult = await super.invoke<T>(opts)

      if (lastResult.ok) return lastResult

      const isRetryable = lastResult.error && this.#isRetryableError(lastResult.error)
      if (!isRetryable || attempt === MaxRetries) return lastResult

      await this.#delay(RetryDelays[attempt])
    }

    return lastResult!
  }

  // --- Domain-specific methods ---

  async listOrgs(): Promise<TApiResponse<Organization[]>> {
    const result = await this.get<Organization[]>({ path: `/orgs` })
    if (result.data) result.data = result.data.map((item) => new Organization(item))
    return result
  }

  async getOrg(orgId: string): Promise<TApiResponse<Organization>> {
    const result = await this.get<Organization>({ path: `/orgs/${orgId}` })
    if (result.data) result.data = new Organization(result.data)
    return result
  }

  async listAgents(orgId: string): Promise<TApiResponse<Agent[]>> {
    const result = await this.get<Agent[]>({ path: `/orgs/${orgId}/agents` })
    if (result.data) result.data = result.data.map((item) => new Agent(item))
    return result
  }

  async getAgent(orgId: string, agentId: string): Promise<TApiResponse<Agent>> {
    const result = await this.get<Agent>({ path: `/orgs/${orgId}/agents/${agentId}` })
    if (result.data) result.data = new Agent(result.data)
    return result
  }

  async createSession(agentId: string, providerId?: string): Promise<TApiResponse<TSessionInfo>> {
    return this.post<TSessionInfo>({
      path: `/ai/sessions`,
      data: { agentId, ...(providerId && { providerId }) },
      headers: { [`Content-Type`]: `application/json` },
    })
  }

  async listProviders(orgId: string): Promise<TApiResponse<TProviderInfo[]>> {
    return this.get<TProviderInfo[]>({ path: `/orgs/${orgId}/providers` })
  }

  async listThreads(orgId: string, agentId: string): Promise<TApiResponse<Thread[]>> {
    const result = await this.get<Thread[]>({
      path: `/orgs/${orgId}/agents/${agentId}/threads`,
    })
    if (result.data) result.data = result.data.map((item) => new Thread(item))
    return result
  }

  async getThread(
    orgId: string,
    agentId: string,
    threadId: string,
    opts?: { include?: string[] }
  ): Promise<TApiResponse<Thread>> {
    const data = opts?.include?.length ? { include: opts.include.join(`,`) } : undefined
    const result = await this.get<Thread>({
      path: `/orgs/${orgId}/agents/${agentId}/threads/${threadId}`,
      data,
    })
    if (result.data) result.data = new Thread(result.data)
    return result
  }

  async branchThread(
    orgId: string,
    agentId: string,
    threadId: string,
    messageId: string
  ): Promise<TApiResponse<Thread>> {
    const result = await this.post<Thread>({
      path: `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/branch`,
      data: { messageId },
      headers: { [`Content-Type`]: `application/json` },
    })
    if (result.data) result.data = new Thread(result.data)
    return result
  }

  async createThread(orgId: string, agentId: string, name?: string): Promise<TApiResponse<Thread>> {
    const result = await this.post<Thread>({
      path: `/orgs/${orgId}/agents/${agentId}/threads`,
      data: { name: name || `REPL session` },
      headers: { [`Content-Type`]: `application/json` },
    })
    if (result.data) result.data = new Thread(result.data)
    return result
  }

  async deleteThread(orgId: string, agentId: string, threadId: string): Promise<TApiResponse> {
    return this.delete({
      path: `/orgs/${orgId}/agents/${agentId}/threads/${threadId}`,
    })
  }

  async listProjects(orgId: string): Promise<TApiResponse<any[]>> {
    return this.get<any[]>({ path: `/orgs/${orgId}/projects` })
  }

  async listSandboxes(orgId: string): Promise<TApiResponse<any[]>> {
    return this.get<any[]>({ path: `/orgs/${orgId}/sandboxes` })
  }

  async connectSandbox(orgId: string, sandboxId: string): Promise<TApiResponse> {
    return this.post({
      path: `/orgs/${orgId}/sandboxes/${sandboxId}/connect`,
      data: {},
      headers: { [`Content-Type`]: `application/json` },
    })
  }

  async listMessages(
    orgId: string,
    agentId: string,
    threadId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TApiResponse<Message[]>> {
    const data: Record<string, any> = {}
    if (opts?.limit != null) data.limit = String(opts.limit)
    if (opts?.offset != null) data.offset = String(opts.offset)

    const result = await this.get<Message[]>({
      path: `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`,
      data: Object.keys(data).length ? data : undefined,
    })
    if (result.data) result.data = result.data.map((item) => new Message(item))
    return result
  }

  async createMessage(
    orgId: string,
    agentId: string,
    threadId: string,
    data: { type: string; content: unknown[]; orgId: string }
  ): Promise<TApiResponse<Message>> {
    const result = await this.post<Message>({
      path: `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`,
      data,
      headers: { [`Content-Type`]: `application/json` },
    })
    if (result.data) result.data = new Message(result.data)
    return result
  }
}

// Backward-compatible export name
export { ReplApiClient as ApiClient }
```

- [ ] **Step 2: Update repl tests**

The repl test file needs significant updates to match the new return-style. Update `repos/repl/src/services/api.test.ts` to test `ReplApiClient` with `{ ok, status, data, error }` response shape instead of throw/catch patterns.

Key changes:
- Mock `fetch` globally instead of inside class
- Assert `result.ok` / `result.error` instead of expect-to-throw
- Retry tests check that `invoke` retries via `super.invoke()` and returns the final result

- [ ] **Step 3: Run repl tests**

Run: `cd repos/repl && pnpm test`
Expected: All tests PASS

- [ ] **Step 4: Run repl type check**

Run: `cd repos/repl && pnpm types`
Expected: No type errors

---

## Task 10: Update Repl Call Sites

**Files:**
- Modify: `repos/repl/src/services/executor.ts`
- Modify: `repos/repl/src/services/executor.test.ts`
- Modify: `repos/repl/src/tasks/agents.ts`
- Modify: `repos/repl/src/tasks/threads.ts`
- Modify: `repos/repl/src/tasks/sandboxes.ts`
- Modify: `repos/repl/src/tasks/ssh.ts`
- Modify: `repos/repl/src/renderers/chatLogic.ts`
- Modify: `repos/repl/src/renderers/chatLogic.test.ts`
- Modify: `repos/repl/src/utils/api/resolveOrg.ts`

All call sites currently use try/catch with thrown errors. They need to switch to `{ data, error }` destructuring.

**Pattern change:**

```typescript
// Before (throw-style):
try {
  const orgs = await client.listOrgs()
  // use orgs...
} catch (err) {
  // handle error
}

// After (return-style):
const { data: orgs, error } = await client.listOrgs()
if (error) {
  // handle error
  return
}
// use orgs...
```

- [ ] **Step 1: Read each consumer file**

Read all 9 files listed above to understand current call patterns.

- [ ] **Step 2: Update each file**

Apply the pattern change above to every call site. For each file:
- Replace try/catch with `const { data, error } = await ...`
- Replace thrown error handling with `if (error)` checks
- Remove unnecessary try/catch blocks

- [ ] **Step 3: Update executor.ts**

The executor uses `client.createSession()` which now returns `{ data, error }`. Update session creation:

```typescript
// Before:
const session = await this.#client.createSession(agentId, providerId)

// After:
const { data: session, error } = await this.#client.createSession(agentId, providerId)
if (error || !session) throw new Error(`Failed to create session: ${error?.message}`)
```

Note: The executor's WebSocket connection logic downstream can stay as-is since it receives the unwrapped session data.

- [ ] **Step 4: Run all repl tests**

Run: `cd repos/repl && pnpm test`
Expected: All tests PASS

- [ ] **Step 5: Run repl type check**

Run: `cd repos/repl && pnpm types`
Expected: No type errors

---

## Task 11: Migrate Integration — Replace api-client.ts

**Files:**
- Modify: `repos/integration/src/utils/api-client.ts`

The integration repo has 84+ test files importing `get`, `post`, `put`, `del` from `api-client`. The key insight: since `TApiResponse` now includes `ok` and `status`, the integration call sites need zero changes — the response shape is compatible.

Strategy: Replace the hand-written `api-client.ts` with an `ApiService` instance + thin convenience functions that maintain the same export signatures.

- [ ] **Step 1: Rewrite api-client.ts**

Replace `repos/integration/src/utils/api-client.ts`:

```typescript
// repos/integration/src/utils/api-client.ts

import { env } from './env'
import { ApiService, type TApiResponse, type TApiRequest } from '@tdsk/domain'

export type { TApiResponse as ApiResponse }

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  apiKey?: string
  noAuth?: boolean
  rawPath?: boolean
  timeout?: number
  rawResponse?: boolean
}

const client = new ApiService({
  url: ``, // set lazily from env.proxyUrl
  basePath: `_`,
})

const ensureClient = () => {
  if (!client.url && env.proxyUrl) {
    client.url = env.proxyUrl
  }
  if (env.testApiKey && !client.headers.Authorization) {
    client.setBearer(env.testApiKey)
  }
}

const toApiRequest = (path: string, opts: RequestOptions = {}): TApiRequest => {
  const {
    method,
    body,
    headers = {},
    apiKey,
    noAuth = false,
    rawPath = false,
    timeout = 15_000,
    rawResponse = false,
  } = opts

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  // Handle auth overrides
  if (noAuth) {
    delete reqHeaders.Authorization
  } else if (apiKey) {
    reqHeaders.Authorization = `Bearer ${apiKey}`
  }

  // Handle rawPath — skip basePath by using full path
  const resolvedPath = rawPath || path.startsWith('/_') || path.startsWith('/health')
    ? undefined
    : path

  return {
    path: resolvedPath,
    data: body as Record<string, any>,
    headers: reqHeaders,
    timeout,
    rawResponse: rawResponse || rawPath,
  }
}

export const api = async <T = unknown>(
  path: string,
  opts: RequestOptions = {}
): Promise<TApiResponse<T>> => {
  ensureClient()

  const request = toApiRequest(path, opts)
  const method = (opts.method || 'GET').toUpperCase()

  // For rawPath, bypass basePath by calling fetch directly on full URL
  if (opts.rawPath || path.startsWith('/_') || path.startsWith('/health')) {
    const rawClient = new ApiService({
      url: env.proxyUrl,
      headers: client.headers,
    })
    if (opts.noAuth) rawClient.clearBearer()
    else if (opts.apiKey) rawClient.setBearer(opts.apiKey)

    const fullPath = path.startsWith('/') ? path.slice(1) : path
    return rawClient[method === 'DELETE' ? 'delete' : method.toLowerCase() as 'get' | 'post' | 'put' | 'patch']<T>({
      ...request,
      path: fullPath,
    })
  }

  if (opts.noAuth) {
    const noAuthClient = new ApiService({
      url: env.proxyUrl,
      basePath: `_`,
      headers: { 'Content-Type': 'application/json' },
    })
    return noAuthClient[method === 'DELETE' ? 'delete' : method.toLowerCase() as 'get' | 'post' | 'put' | 'patch']<T>(request)
  }

  if (opts.apiKey) {
    const keyHeaders = { ...client.headers, Authorization: `Bearer ${opts.apiKey}` }
    return client[method === 'DELETE' ? 'delete' : method.toLowerCase() as 'get' | 'post' | 'put' | 'patch']<T>({
      ...request,
      headers: { ...request.headers, ...keyHeaders },
    })
  }

  switch (method) {
    case 'POST': return client.post<T>(request)
    case 'PUT': return client.put<T>(request)
    case 'DELETE': return client.delete<T>(request)
    case 'PATCH': return client.patch<T>(request)
    default: return client.get<T>(request)
  }
}

export const get = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'GET' })

export const post = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'POST', body })

export const put = <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'PUT', body })

export const del = <T = unknown>(path: string, opts?: RequestOptions) =>
  api<T>(path, { ...opts, method: 'DELETE' })
```

- [ ] **Step 2: Run integration type check**

Run: `cd repos/integration && pnpm types`
Expected: No type errors. The `ApiResponse` type from the old client had `{ status, ok, data, limit?, offset?, warning?, message? }`. The new `TApiResponse` has `{ ok, status, data?, error? }`. The `limit/offset/warning/message` fields come from envelope unwrapping and are spread onto the response by `parseResponse`, so they'll still be present at runtime.

- [ ] **Step 3: Run integration tests** (requires K8s)

Run: `cd repos/integration && pnpm test`
Expected: All tests PASS — call sites use `{ ok, status, data }` which is unchanged.

---

## Task 12: Cross-Repo Type Check and Final Validation

**Files:** None (validation only)

- [ ] **Step 1: Run full type check from root**

Run: `pnpm types`
Expected: All repos pass type checking

- [ ] **Step 2: Run all unit tests from root**

Run: `pnpm test`
Expected: All unit tests pass across all repos

- [ ] **Step 3: Stage all changes**

Run: `git add repos/domain/src/services/api/ repos/backend/src/services/api.ts repos/backend/src/services/api.test.ts repos/backend/src/types/api.types.ts repos/backend/src/utils/api/objToQuery.ts repos/backend/src/utils/api/toFormData.ts repos/backend/src/services/email/strategies/resend.ts repos/admin/src/services/api.ts repos/admin/src/services/api.test.ts repos/admin/src/types/api.types.ts repos/admin/src/utils/api/objToQuery.tsx repos/admin/src/utils/api/genFormData.ts repos/admin/src/utils/errors/ApiError.ts repos/repl/src/services/api.ts repos/repl/src/services/api.test.ts repos/repl/src/services/executor.ts repos/repl/src/services/executor.test.ts repos/repl/src/tasks/ repos/repl/src/renderers/ repos/repl/src/utils/api/resolveOrg.ts repos/integration/src/utils/api-client.ts repos/domain/src/services/index.ts`

- [ ] **Step 4: Output commit message**

Output (DO NOT run git commit):

```
feat(domain): extract shared ApiService fetch wrapper

Move duplicated fetch wrapper logic from backend, admin, repl, and
integration repos into @tdsk/domain as a shared ApiService class.

- Add ApiService with protected override points (invoke, buildUrl,
  buildHeaders, buildBody, parseResponse, buildError)
- Move objToQuery and toFormData utilities to domain
- Backend: use ApiService directly (re-export as API for compat)
- Admin: AdminApiService extends ApiService (401 retry, React Query)
- Repl: ReplApiClient extends ApiService (exponential backoff)
- Integration: ApiService instance with convenience functions
- Unified response type: { ok, status, data?, error? }
```
