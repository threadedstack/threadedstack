# Shared ApiService Design Spec

**Date**: 2026-04-05
**Status**: Draft
**Scope**: Extract a shared `ApiService` fetch wrapper into `@tdsk/domain` for reuse across backend, admin, repl, integration, and the new threads app.

---

## Problem

Four repos implement nearly identical fetch wrappers independently:

| Repo | File | Class/Function | Lines |
|------|------|---------------|-------|
| backend | `src/services/api.ts` | `API` class | 122 |
| admin | `src/services/api.ts` | `ApiService` class | 193 |
| repl | `src/services/api.ts` | `ApiClient` class | 218 |
| integration | `src/utils/api-client.ts` | `api()` function | 108 |

All four wrap native `fetch` with JSON serialization, Bearer auth headers, and typed responses. Supporting utilities (`objToQuery`, `toFormData`) are duplicated between backend and admin. Each repo reinvents URL building, error handling, and response parsing with minor variations.

The upcoming threads app needs the same fetch primitives, which would be a fifth copy.

## Solution

A single `ApiService` class in `@tdsk/domain` with protected override points. Repos subclass to add their specific behaviors (retry, token refresh, React Query). Supporting utilities (`objToQuery`, `toFormData`) move to domain alongside the service.

## Architecture: Single Class with Method Overrides (Approach A)

```
@tdsk/domain: ApiService
    ├── backend:     uses ApiService directly (no subclass needed)
    ├── admin:       AdminApiService extends ApiService (401 retry, React Query, bearer management)
    ├── repl:        ReplApiClient extends ApiService (exponential backoff, AuthManager DI)
    ├── integration: configured instance + convenience functions (get/post/put/del)
    └── threads:     subclasses as needed
```

### Why This Approach

- Consumer count is small (5 repos) — composition/mixin patterns solve problems we don't have
- Override points are clear and well-bounded
- Matches existing class-based patterns across the codebase
- Each repo controls its extensions without forking core logic

---

## Types

```typescript
// domain/src/services/api/api.types.ts

import type { Exception } from '@tdsk/domain'

/** HTTP methods supported by the service */
export enum EApiMethod {
  GET = 'GET',
  PUT = 'PUT',
  POST = 'POST',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

/** Constructor config for ApiService */
export type TApiConfig = {
  url: string
  basePath?: string
  headers?: Record<string, string>
  options?: Omit<RequestInit, 'body' | 'headers' | 'method'>
}

/** Per-request options passed to get/post/put/delete */
export type TApiRequest = Omit<Partial<RequestInit>, 'body' | 'headers'> & {
  path?: string
  data?: Record<string, any> | string
  form?: boolean
  headers?: Record<string, string>
  responseType?: 'json' | 'text'
  rawResponse?: boolean
  error?: string
  timeout?: number
}

/** Internal type after request extension (url resolved, body serialized) */
export type TApiRequestExt = Omit<TApiRequest, 'body' | 'data'> & {
  url: string
  body?: string | FormData
  method: EApiMethod
}

/** Standard response — always includes ok + status, plus data or error */
export type TApiResponse<T = Record<string, any>> = {
  ok: boolean
  status: number
  data?: T
  error?: Exception
}

/** Response metadata from envelope unwrapping */
export type TApiMeta = {
  limit?: number
  offset?: number
  warning?: string
  message?: string
  [key: string]: unknown
}
```

### Key Type Decisions

- **`TApiResponse` includes `ok` and `status`** — always populated from the HTTP response. Repos that only need `{ data, error }` destructure what they want. Integration call sites stay unchanged.
- **`Exception` is the universal error type** — already exists in domain, has `status`, `message`, `code`, `details`. Replaces admin's `ApiError` and repl's thrown `Error` strings.
- **`EApiMethod` consolidates duplicates** — backend and admin both define their own enum today.
- **`TApiRequest` excludes React Query fields** — `queryKey`, `staleTime`, `refetchInterval` belong to admin's subclass, not the shared core.
- **`timeout`** — optional per-request timeout via `AbortSignal.timeout(ms)`. No default (unlimited). Integration was the only repo using this; now available everywhere.

---

## ApiService Class

```typescript
// domain/src/services/api/apiService.ts

export class ApiService {
  url: string
  basePath: string
  headers: Record<string, string>
  options: Omit<RequestInit, 'body' | 'headers' | 'method'>

  constructor(config: TApiConfig)

  // --- Mutable header management ---
  setHeaders(update: Record<string, string>, merge?: boolean): void
  setBearer(token: string): void
  clearBearer(): void

  // --- HTTP method shortcuts (public API) ---
  get<T>(opts: TApiRequest): Promise<TApiResponse<T>>
  post<T>(opts: TApiRequest): Promise<TApiResponse<T>>
  put<T>(opts: TApiRequest): Promise<TApiResponse<T>>
  delete<T>(opts: TApiRequest): Promise<TApiResponse<T>>
  patch<T>(opts: TApiRequest): Promise<TApiResponse<T>>

  // --- Protected override points ---
  protected invoke<T>(opts: TApiRequest & { method: EApiMethod }): Promise<TApiResponse<T>>
  protected buildUrl(path?: string, params?: string | Record<string, any>): string
  protected buildHeaders(requestHeaders?: Record<string, string>): Record<string, string>
  protected buildBody(data: TApiRequest['data'], form?: boolean): string | FormData | undefined
  protected parseResponse<T>(res: Response, opts: TApiRequest): Promise<TApiResponse<T>>
  protected buildError(message: string, status: number, text?: string): Exception
}
```

### Request Flow

```
get({ path: '/orgs', data: { limit: 10 } })
  -> invoke({ ..., method: GET })
    -> buildUrl('/orgs', { limit: 10 })       -> "https://host/_/orgs?limit=10"
    -> buildHeaders({ ... })                   -> merged headers
    -> buildBody(undefined, false)             -> undefined (GET has no body)
    -> fetch(url, { method, headers, body, signal? })
    -> parseResponse(res, opts)                -> { ok, status, data } or { ok, status, error }
```

### Protected Override Points

| Method | Default Behavior | Subclass Override Example |
|--------|-----------------|--------------------------|
| `invoke` | Calls fetch via build* helpers, routes to `parseResponse` or `buildError` | Admin: wraps with 401 token-refresh retry. Repl: wraps with exponential backoff. |
| `buildUrl` | `{url}/{basePath}/{path}` with slash normalization + `objToQuery` for GET params | — |
| `buildHeaders` | Merges instance `headers` with per-request `headers` | — |
| `buildBody` | `JSON.stringify(data)` or `toFormData(data)` when `form: true` | — |
| `parseResponse` | Unwraps `{ data, ...meta }` envelope. Respects `rawResponse` and `responseType`. Returns `{ ok, status, data }` or `{ ok, status, error }` | Integration could preserve metadata fields |
| `buildError` | `new Exception(status, message)` with optional status text | — |

### Mutable Header Management

```typescript
setHeaders(update: Record<string, string>, merge = true): void
// merge=true: spreads update over existing headers
// merge=false: replaces headers entirely

setBearer(token: string): void
// Sets Authorization: Bearer {token}

clearBearer(): void
// Removes Authorization header
```

Headers are instance-level state, mutated in place. Per-request headers (via `opts.headers`) merge on top at call time without mutating instance state.

### Envelope Unwrapping

The backend API returns `{ data: T, limit?, offset?, warning?, message?, overrides? }`. By default, `parseResponse` extracts `data` as the typed payload and discards the envelope. When `rawResponse: true`, the full parsed JSON is returned as `data` without unwrapping.

Network failures (fetch rejected) return `{ ok: false, status: 0, error: Exception }`.
JSON parse failures return `{ ok: false, status: <http status>, error: Exception }`.

---

## Utility Functions

### objToQuery

Moves from `repos/backend/src/utils/api/objToQuery.ts` (and identical copy in admin) to `domain/src/services/api/objToQuery.ts`.

```typescript
export type TObjToQueryOpts = {
  array?: 'string' | 'repeated'
}

export const objToQuery = <T extends string>(
  obj: Record<string, any>,
  opts?: TObjToQueryOpts
): T
```

Handles: strings, numbers, booleans, arrays (repeated params or comma-joined), nested objects (JSON stringified), null/undefined filtering, URL encoding.

### toFormData

Consolidates `repos/backend/src/utils/api/toFormData.ts` and `repos/admin/src/utils/api/genFormData.ts` (functionally identical).

```typescript
export const toFormData = (data: Record<string, any>): FormData
```

Objects are JSON stringified, primitives passed as-is.

---

## File Layout

```
repos/domain/src/services/api/
  index.ts             # barrel: ApiService, types, objToQuery, toFormData
  apiService.ts        # ApiService class
  api.types.ts         # TApiConfig, TApiRequest, TApiResponse, TApiMeta, EApiMethod
  objToQuery.ts        # moved from backend/admin
  toFormData.ts        # consolidated from backend + admin
  apiService.test.ts   # unit tests
```

Exported via existing barrel chain: `services/api/index.ts` -> `services/index.ts` -> `domain/src/index.ts`.

Consumer import:
```typescript
import { ApiService, type TApiResponse, type TApiRequest } from '@tdsk/domain'
```

---

## Per-Repo Migration

### Backend

**Change**: Replace local `API` class with `ApiService` from domain.

- Delete `src/services/api.ts`, `src/types/api.types.ts`, `src/utils/api/objToQuery.ts`, `src/utils/api/toFormData.ts`
- Import `ApiService` from `@tdsk/domain`
- No subclass needed — backend uses `ApiService` directly for external API calls (Resend, etc.)
- Call sites unchanged: `new ApiService({ url, headers })` then `api.get(...)` / `api.post(...)`
- Return type changes from `{ data?, error? }` to `{ ok, status, data?, error? }` — existing destructuring `const { data, error } = ...` still works

### Admin

**Change**: `AdminApiService extends ApiService` replaces local `ApiService`.

- Delete `src/utils/api/objToQuery.tsx`, `src/utils/api/genFormData.ts`, `src/utils/errors/ApiError.ts`
- Delete local `EAPIMethod` enum, `TApiRes`, `TApiReq` types (use domain types)
- `AdminApiService` adds:
  - `bearer(auth?)` — Neon Auth token management (calls `authClient.getSession()`)
  - Override `invoke` — wraps `super.invoke()` with 401 token-refresh retry via `tokenRefresh.refreshAndRetry()`
  - Override `get` — integrates React Query (`query.fetch`, `queryKey`, `staleTime`, `refetchInterval`)
- `BaseApi` class stays, references `AdminApiService` singleton
- Error handling: `Exception` replaces `ApiError` — same shape (`status` + `message`), `_onError` toast pattern unchanged

### Repl

**Change**: `ReplApiClient extends ApiService` replaces local `ApiClient`.

- Constructor takes `AuthManager`, extracts `proxyUrl` and `apiKey` from creds, calls `super({ url: proxyUrl, basePath: '_', headers: { Authorization: Bearer ... } })`
- Override `invoke` — wraps `super.invoke()` with exponential backoff retry (429, 500, 502, 503, network errors)
- Domain-specific methods (`listOrgs`, `listAgents`, `listThreads`, etc.) stay on the subclass
- Call sites updated from throw-style to return-style: `const { data, error } = await client.listOrgs()` instead of `try { const orgs = await client.listOrgs() }`
- Domain model instantiation (`new Organization(resp)`) moves to call sites or stays in subclass methods

### Integration

**Change**: Configured `ApiService` instance + thin convenience functions.

- Delete local `api-client.ts`
- Create `api-client.ts` that instantiates `ApiService` with `env.proxyUrl`, `basePath: '_'`, and test API key bearer header
- Export `get`, `post`, `put`, `del` as convenience functions wrapping the instance
- `noAuth` — handled by creating a second headerless instance or passing empty auth header
- `rawPath` — calls `client.get({ path, rawResponse: true })` or builds URL manually
- `timeout` — passed through as `{ timeout: 15_000 }` per request
- Call sites largely unchanged — `{ ok, status, data }` shape matches existing `ApiResponse<T>`

### Threads App

- Subclasses `ApiService` with whatever auth and retry semantics it needs
- Clean starting point — no legacy patterns to migrate

---

## What Stays Out of Core

- **401 token-refresh retry** — admin-specific (Neon Auth session management)
- **Exponential backoff retry** — repl-specific (CLI resilience for flaky connections)
- **React Query integration** — admin-specific (browser caching layer)
- **Domain model instantiation** — repo-specific (wrapping API data in model classes)
- **`noAuth` / `rawPath`** — integration-test-specific (thin wrappers, not core features)
- **Toast notifications** — admin-specific (`_onError` on `BaseApi`)

---

## Testing Strategy

**Domain unit tests** (`apiService.test.ts`):
- Mock `fetch` globally
- Test each HTTP method routes correctly
- Test `buildUrl` with basePath, path, query params
- Test header merging (instance + per-request)
- Test FormData serialization when `form: true`
- Test envelope unwrapping vs `rawResponse: true`
- Test error responses return `{ ok: false, status, error: Exception }`
- Test network failures return `{ ok: false, status: 0, error }`
- Test `timeout` applies `AbortSignal.timeout`
- Test `setHeaders`, `setBearer`, `clearBearer` mutations

**Per-repo tests**: Each repo's existing test suite validates its subclass/wrapper behavior. Migration should not change test expectations beyond the response shape additions (`ok`, `status`).
