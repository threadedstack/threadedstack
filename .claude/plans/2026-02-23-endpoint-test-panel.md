# Endpoint Test Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full request builder and response viewer to the EndpointDrawer so users can test Proxy and FaaS endpoints directly from the admin UI.

**Architecture:** Component → Action → Service pattern. `EndpointTestPanel` component calls `testEndpoint` action, which calls `endpointTestApi.execute()`, which uses raw `fetch` to `/proxy/:projectId/:endpointId`. Results displayed via Monaco editor. Drawer gains Configure/Test tabs (Test only in edit mode).

**Tech Stack:** React, MUI (Tabs, Select, TextField, Chip, Button, IconButton), Monaco editor (`@tdsk/components`), Vitest

**Design Doc:** `docs/plans/2026-02-23-endpoint-test-panel-design.md`

**CRITICAL GIT RULES:**
- **NEVER** commit, amend, revert, or change git history
- **NEVER** run: `git add`, `git commit`, `git push`, `git reset`, `git revert`
- Read-only git operations ONLY: `git status`, `git diff`, `git log`

---

## Task 1: EndpointTestApi Service

**Files:**
- Create: `repos/admin/src/services/endpointTestApi.ts`
- Create: `repos/admin/src/services/endpointTestApi.test.ts`
- Modify: `repos/admin/src/services/index.ts`

### Step 1: Write the failing test

Create `repos/admin/src/services/endpointTestApi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TAF/services/auth`, () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { token: `test-token` }, user: { id: `u1` } },
    }),
  },
}))

vi.mock(`@TAF/utils/api/apiUrl`, () => ({
  apiUrl: () => `https://test.local`,
}))

vi.mock(`@TAF/services/query`, () => ({
  query: {
    fetch: vi.fn(),
    options: vi.fn((o: any) => o),
  },
}))

vi.mock(`@TAF/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: vi.fn().mockResolvedValue(false),
  },
}))

describe(`EndpointTestApi`, () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  const makeResponse = (
    status: number,
    body: string,
    contentType = 'application/json'
  ) =>
    new Response(body, {
      status,
      statusText: status < 400 ? 'OK' : 'Error',
      headers: { 'Content-Type': contentType },
    })

  it(`should construct correct URL from projectId and endpointId`, async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, '{}'))

    const { endpointTestApi } = await import('./endpointTestApi')

    await endpointTestApi.execute('proj-123', 'ep-456', {
      method: 'GET',
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('https://test.local/proxy/proj-123/ep-456')
  })

  it(`should forward HTTP method`, async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, '{}'))

    const { endpointTestApi } = await import('./endpointTestApi')

    await endpointTestApi.execute('proj-1', 'ep-1', {
      method: 'POST',
    })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('POST')
  })

  it(`should merge custom headers with auth headers`, async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, '{}'))

    const { endpointTestApi } = await import('./endpointTestApi')

    await endpointTestApi.execute('proj-1', 'ep-1', {
      method: 'GET',
      headers: { 'X-Custom': 'value' },
    })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers['X-Custom']).toBe('value')
  })

  it(`should forward request body`, async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, '{}'))

    const { endpointTestApi } = await import('./endpointTestApi')

    await endpointTestApi.execute('proj-1', 'ep-1', {
      method: 'POST',
      body: '{"test": true}',
    })

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.body).toBe('{"test": true}')
  })

  it(`should return status, statusText, body, contentType, and timing`, async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, '{"result": "ok"}', 'application/json')
    )

    const { endpointTestApi } = await import('./endpointTestApi')

    const result = await endpointTestApi.execute('proj-1', 'ep-1', {
      method: 'GET',
    })

    expect(result.data).toBeDefined()
    expect(result.data!.status).toBe(200)
    expect(result.data!.statusText).toBe('OK')
    expect(result.data!.body).toBe('{"result": "ok"}')
    expect(result.data!.contentType).toContain('application/json')
    expect(result.data!.timing).toBeGreaterThanOrEqual(0)
  })

  it(`should return data even for 4xx/5xx responses (not error)`, async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse(404, '{"error": "not found"}')
    )

    const { endpointTestApi } = await import('./endpointTestApi')

    const result = await endpointTestApi.execute('proj-1', 'ep-1', {
      method: 'GET',
    })

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
    expect(result.data!.status).toBe(404)
  })

  it(`should return error for network failures`, async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { endpointTestApi } = await import('./endpointTestApi')

    const result = await endpointTestApi.execute('proj-1', 'ep-1', {
      method: 'GET',
    })

    expect(result.error).toBeDefined()
    expect(result.data).toBeUndefined()
  })
})
```

### Step 2: Run test to verify it fails

Run: `cd repos/admin && pnpm test -- src/services/endpointTestApi.test.ts`

Expected: FAIL — `endpointTestApi` module does not exist

### Step 3: Write the implementation

Create `repos/admin/src/services/endpointTestApi.ts`:

```typescript
import { BaseApi } from '@TAF/services/api'
import { apiUrl } from '@TAF/utils/api/apiUrl'

export type TEndpointTestResult = {
  status: number
  statusText: string
  body: string
  contentType: string
  timing: number
}

export type TEndpointTestOpts = {
  method: string
  headers?: Record<string, string>
  body?: string
}

export type TEndpointTestRes = {
  data?: TEndpointTestResult
  error?: Error
}

export class EndpointTestApi extends BaseApi {

  async execute(
    projectId: string,
    endpointId: string,
    opts: TEndpointTestOpts
  ): Promise<TEndpointTestRes> {
    const { method, headers = {}, body } = opts
    const baseUrl = apiUrl({}).replace(/\/$/, '')
    const url = `${baseUrl}/proxy/${projectId}/${endpointId}`

    const authHeaders: Record<string, string> = {}
    const authHeader = this.api.options.headers?.Authorization
    if (authHeader) authHeaders.Authorization = authHeader

    const start = performance.now()

    try {
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, ...headers },
        body: body || undefined,
      })

      const timing = Math.round(performance.now() - start)
      const contentType = res.headers.get('content-type') || 'text/plain'
      const responseBody = await res.text()

      return {
        data: {
          status: res.status,
          statusText: res.statusText,
          body: responseBody,
          contentType,
          timing,
        },
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }
}

export const endpointTestApi = new EndpointTestApi()
```

### Step 4: Add export to services barrel

Add to `repos/admin/src/services/index.ts`:

```typescript
export * from './endpointTestApi'
```

### Step 5: Run test to verify it passes

Run: `cd repos/admin && pnpm test -- src/services/endpointTestApi.test.ts`

Expected: All 7 tests PASS

---

## Task 2: testEndpoint Action

**Files:**
- Create: `repos/admin/src/actions/endpoints/api/testEndpoint.ts`
- Create: `repos/admin/src/actions/endpoints/api/testEndpoint.test.ts`
- Modify: `repos/admin/src/actions/endpoints/api/index.ts`

### Step 1: Write the failing test

Create `repos/admin/src/actions/endpoints/api/testEndpoint.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExecute = vi.fn()

vi.mock('@TAF/services', () => ({
  endpointTestApi: {
    execute: (...args: any[]) => mockExecute(...args),
  },
}))

describe('testEndpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call endpointTestApi.execute with correct args', async () => {
    mockExecute.mockResolvedValueOnce({
      data: { status: 200, statusText: 'OK', body: '{}', contentType: 'application/json', timing: 42 },
    })

    const { testEndpoint } = await import('./testEndpoint')

    await testEndpoint({
      projectId: 'proj-1',
      endpointId: 'ep-1',
      method: 'POST',
      headers: { 'X-Test': 'val' },
      body: '{"a":1}',
    })

    expect(mockExecute).toHaveBeenCalledWith('proj-1', 'ep-1', {
      method: 'POST',
      headers: { 'X-Test': 'val' },
      body: '{"a":1}',
    })
  })

  it('should return data on success', async () => {
    const mockData = {
      data: { status: 200, statusText: 'OK', body: '{"ok":true}', contentType: 'application/json', timing: 50 },
    }
    mockExecute.mockResolvedValueOnce(mockData)

    const { testEndpoint } = await import('./testEndpoint')

    const result = await testEndpoint({
      projectId: 'proj-1',
      endpointId: 'ep-1',
      method: 'GET',
    })

    expect(result.data).toBeDefined()
    expect(result.data!.status).toBe(200)
  })

  it('should return error on failure', async () => {
    mockExecute.mockResolvedValueOnce({
      error: new Error('Network error'),
    })

    const { testEndpoint } = await import('./testEndpoint')

    const result = await testEndpoint({
      projectId: 'proj-1',
      endpointId: 'ep-1',
      method: 'GET',
    })

    expect(result.error).toBeDefined()
    expect(result.error!.message).toBe('Network error')
  })
})
```

### Step 2: Run test to verify it fails

Run: `cd repos/admin && pnpm test -- src/actions/endpoints/api/testEndpoint.test.ts`

Expected: FAIL — module does not exist

### Step 3: Write the implementation

Create `repos/admin/src/actions/endpoints/api/testEndpoint.ts`:

```typescript
import type { TEndpointTestRes } from '@TAF/services/endpointTestApi'
import { endpointTestApi } from '@TAF/services'

export type TTestEndpointOpts = {
  projectId: string
  endpointId: string
  method: string
  headers?: Record<string, string>
  body?: string
}

export const testEndpoint = async (opts: TTestEndpointOpts): Promise<TEndpointTestRes> => {
  const { projectId, endpointId, method, headers, body } = opts

  return endpointTestApi.execute(projectId, endpointId, {
    method,
    headers,
    body,
  })
}
```

### Step 4: Add export to actions barrel

Add to `repos/admin/src/actions/endpoints/api/index.ts`:

```typescript
export * from './testEndpoint'
```

### Step 5: Run test to verify it passes

Run: `cd repos/admin && pnpm test -- src/actions/endpoints/api/testEndpoint.test.ts`

Expected: All 3 tests PASS

---

## Task 3: useEndpointTest Hook

**Files:**
- Create: `repos/admin/src/hooks/endpoints/useEndpointTest.ts`
- Create: `repos/admin/src/hooks/endpoints/useEndpointTest.test.ts`

### Step 1: Write the failing test

Create `repos/admin/src/hooks/endpoints/useEndpointTest.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockTestEndpoint = vi.fn()

vi.mock('@TAF/actions/endpoints/api/testEndpoint', () => ({
  testEndpoint: (...args: any[]) => mockTestEndpoint(...args),
}))

describe('useEndpointTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    expect(result.current.request.method).toBe('GET')
    expect(result.current.request.headers).toHaveLength(1)
    expect(result.current.request.headers[0].key).toBe('Content-Type')
    expect(result.current.request.body).toBe('')
    expect(result.current.response).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should update method', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    act(() => result.current.setMethod('POST'))

    expect(result.current.request.method).toBe('POST')
  })

  it('should update body', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    act(() => result.current.setBody('{"test": true}'))

    expect(result.current.request.body).toBe('{"test": true}')
  })

  it('should add and remove headers', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    act(() => result.current.addHeader())
    expect(result.current.request.headers).toHaveLength(2)

    act(() => result.current.removeHeader(1))
    expect(result.current.request.headers).toHaveLength(1)
  })

  it('should update header key and value', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    act(() => result.current.updateHeader(0, 'key', 'Authorization'))
    act(() => result.current.updateHeader(0, 'value', 'Bearer tok'))

    expect(result.current.request.headers[0].key).toBe('Authorization')
    expect(result.current.request.headers[0].value).toBe('Bearer tok')
  })

  it('should call testEndpoint action and set response on success', async () => {
    const mockData = {
      status: 200,
      statusText: 'OK',
      body: '{"ok":true}',
      contentType: 'application/json',
      timing: 100,
    }
    mockTestEndpoint.mockResolvedValueOnce({ data: mockData })

    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    await act(async () => {
      await result.current.sendRequest()
    })

    expect(mockTestEndpoint).toHaveBeenCalledWith({
      projectId: 'p1',
      endpointId: 'e1',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: undefined,
    })

    expect(result.current.response).toBeDefined()
    expect(result.current.response!.status).toBe(200)
    expect(result.current.loading).toBe(false)
  })

  it('should set error on failure', async () => {
    mockTestEndpoint.mockResolvedValueOnce({
      error: new Error('Network error'),
    })

    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    await act(async () => {
      await result.current.sendRequest()
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.response).toBeNull()
  })

  it('should clear response', async () => {
    const mockData = {
      status: 200,
      statusText: 'OK',
      body: '{}',
      contentType: 'application/json',
      timing: 50,
    }
    mockTestEndpoint.mockResolvedValueOnce({ data: mockData })

    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    await act(async () => {
      await result.current.sendRequest()
    })

    expect(result.current.response).not.toBeNull()

    act(() => result.current.clearResponse())

    expect(result.current.response).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should compute correct Monaco language from contentType', async () => {
    const { contentTypeToLanguage } = await import('./useEndpointTest')

    expect(contentTypeToLanguage('application/json')).toBe('json')
    expect(contentTypeToLanguage('application/json; charset=utf-8')).toBe('json')
    expect(contentTypeToLanguage('text/html')).toBe('html')
    expect(contentTypeToLanguage('text/xml')).toBe('xml')
    expect(contentTypeToLanguage('application/xml')).toBe('xml')
    expect(contentTypeToLanguage('text/css')).toBe('css')
    expect(contentTypeToLanguage('text/javascript')).toBe('javascript')
    expect(contentTypeToLanguage('application/javascript')).toBe('javascript')
    expect(contentTypeToLanguage('text/markdown')).toBe('markdown')
    expect(contentTypeToLanguage('text/yaml')).toBe('yaml')
    expect(contentTypeToLanguage('application/x-yaml')).toBe('yaml')
    expect(contentTypeToLanguage('text/plain')).toBe('plaintext')
    expect(contentTypeToLanguage('application/octet-stream')).toBe('plaintext')
  })

  it('should not send body for GET method', async () => {
    mockTestEndpoint.mockResolvedValueOnce({
      data: { status: 200, statusText: 'OK', body: '{}', contentType: 'application/json', timing: 10 },
    })

    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ projectId: 'p1', endpointId: 'e1' })
    )

    act(() => result.current.setBody('{"should": "be ignored"}'))

    await act(async () => {
      await result.current.sendRequest()
    })

    expect(mockTestEndpoint).toHaveBeenCalledWith(
      expect.objectContaining({ body: undefined })
    )
  })
})
```

### Step 2: Run test to verify it fails

Run: `cd repos/admin && pnpm test -- src/hooks/endpoints/useEndpointTest.test.ts`

Expected: FAIL — module does not exist

### Step 3: Write the implementation

Create `repos/admin/src/hooks/endpoints/useEndpointTest.ts`:

```typescript
import { useState, useCallback, useMemo } from 'react'
import { testEndpoint } from '@TAF/actions/endpoints/api/testEndpoint'

type THeader = { key: string; value: string }

export type TEndpointTestResponse = {
  status: number
  statusText: string
  body: string
  contentType: string
  timing: number
}

export type TUseEndpointTestOpts = {
  projectId: string
  endpointId: string
}

const defaultHeaders: THeader[] = [{ key: 'Content-Type', value: 'application/json' }]
const bodylessMethods = ['GET', 'HEAD']

export const contentTypeToLanguage = (contentType: string): string => {
  const ct = contentType.toLowerCase().split(';')[0].trim()
  if (ct.includes('json')) return 'json'
  if (ct.includes('html')) return 'html'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('css')) return 'css'
  if (ct.includes('javascript')) return 'javascript'
  if (ct.includes('markdown')) return 'markdown'
  if (ct.includes('yaml')) return 'yaml'
  return 'plaintext'
}

export const useEndpointTest = (opts: TUseEndpointTestOpts) => {
  const { projectId, endpointId } = opts

  const [method, setMethod] = useState('GET')
  const [headers, setHeaders] = useState<THeader[]>([...defaultHeaders])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<TEndpointTestResponse | null>(null)

  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { key: '', value: '' }])
  }, [])

  const removeHeader = useCallback((index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateHeader = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    )
  }, [])

  const clearResponse = useCallback(() => {
    setResponse(null)
    setError(null)
  }, [])

  const sendRequest = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    const headersObj: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) headersObj[h.key.trim()] = h.value
    }

    const isBodyless = bodylessMethods.includes(method.toUpperCase())

    const result = await testEndpoint({
      projectId,
      endpointId,
      method: method.toUpperCase(),
      headers: headersObj,
      body: isBodyless ? undefined : body || undefined,
    })

    if (result.error) {
      setError(result.error.message || 'Request failed')
    } else if (result.data) {
      setResponse(result.data)
    }

    setLoading(false)
  }, [projectId, endpointId, method, headers, body])

  const monacoLanguage = useMemo(
    () => (response ? contentTypeToLanguage(response.contentType) : 'json'),
    [response]
  )

  return {
    request: { method, headers, body },
    response,
    loading,
    error,
    monacoLanguage,
    setMethod,
    setBody,
    addHeader,
    removeHeader,
    updateHeader,
    sendRequest,
    clearResponse,
  }
}
```

### Step 4: Run test to verify it passes

Run: `cd repos/admin && pnpm test -- src/hooks/endpoints/useEndpointTest.test.ts`

Expected: All 10 tests PASS

---

## Task 4: EndpointTestPanel Component

**Files:**
- Create: `repos/admin/src/components/Endpoints/EndpointTestPanel.tsx`

### Step 1: Write the component

Create `repos/admin/src/components/Endpoints/EndpointTestPanel.tsx`:

```typescript
import {
  Box,
  Chip,
  Button,
  Select,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  InputLabel,
  FormControl,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  ClearAll as ClearIcon,
} from '@mui/icons-material'
import { Code } from '@TAF/components/Code/Code'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useEndpointTest, contentTypeToLanguage } from '@TAF/hooks/endpoints/useEndpointTest'

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const bodylessMethods = ['GET', 'HEAD']

const statusColor = (status: number): 'success' | 'warning' | 'error' => {
  if (status < 300) return 'success'
  if (status < 400) return 'warning'
  return 'error'
}

export type TEndpointTestPanel = {
  projectId: string
  endpointId: string
}

export const EndpointTestPanel = (props: TEndpointTestPanel) => {
  const { projectId, endpointId } = props

  const {
    request,
    response,
    loading,
    error,
    monacoLanguage,
    setMethod,
    setBody,
    addHeader,
    removeHeader,
    updateHeader,
    sendRequest,
    clearResponse,
  } = useEndpointTest({ projectId, endpointId })

  const showBody = !bodylessMethods.includes(request.method.toUpperCase())

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && (
        <ErrorAlert
          message={error}
          onClose={() => clearResponse()}
        />
      )}

      {/* Method selector */}
      <FormControl size='small'>
        <InputLabel>Method</InputLabel>
        <Select
          value={request.method}
          label='Method'
          onChange={(e) => setMethod(e.target.value)}
        >
          {methods.map((m) => (
            <MenuItem key={m} value={m}>{m}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Headers */}
      <Box>
        <Typography variant='subtitle2' sx={{ mb: 1 }}>
          Headers
        </Typography>
        {request.headers.map((header, index) => (
          <Box
            key={index}
            sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
          >
            <TextField
              size='small'
              placeholder='Key'
              value={header.key}
              onChange={(e) => updateHeader(index, 'key', e.target.value)}
              sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
            />
            <TextField
              size='small'
              placeholder='Value'
              value={header.value}
              onChange={(e) => updateHeader(index, 'value', e.target.value)}
              sx={{ flex: 2, '& .MuiInputBase-root': { bgcolor: 'background.paper' } }}
            />
            <IconButton
              size='small'
              onClick={() => removeHeader(index)}
              aria-label='Remove header'
            >
              <CloseIcon fontSize='small' />
            </IconButton>
          </Box>
        ))}
        <Button
          size='small'
          startIcon={<AddIcon />}
          onClick={addHeader}
        >
          Add Header
        </Button>
      </Box>

      {/* Body editor */}
      {showBody && (
        <Code
          label='Body'
          language='json'
          value={request.body}
          onChange={(val) => setBody(val || '')}
          sx={{ minHeight: 120 }}
          options={{ minimap: { enabled: false }, lineNumbers: 'off', wordWrap: 'on' }}
        />
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant='contained'
          startIcon={loading ? <CircularProgress size={16} color='inherit' /> : <PlayIcon />}
          onClick={sendRequest}
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Request'}
        </Button>
        {response && (
          <Button
            variant='outlined'
            startIcon={<ClearIcon />}
            onClick={clearResponse}
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Response */}
      {response && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              size='small'
              color={statusColor(response.status)}
              label={`${response.status} ${response.statusText}`}
            />
            <Typography variant='body2' color='text.secondary'>
              {response.timing}ms
            </Typography>
          </Box>
          <Code
            label='Response'
            language={monacoLanguage}
            value={response.body}
            disabled={true}
            sx={{ minHeight: 200 }}
            options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on' }}
          />
        </Box>
      )}
    </Box>
  )
}
```

### Step 2: Run admin tests to verify no breakage

Run: `cd repos/admin && pnpm test`

Expected: All existing tests PASS, no regressions

---

## Task 5: EndpointDrawer Tab Integration

**Files:**
- Modify: `repos/admin/src/components/Endpoints/EndpointDrawer.tsx`

### Step 1: Modify EndpointDrawer to add tabs

Open `repos/admin/src/components/Endpoints/EndpointDrawer.tsx`.

**Changes:**

1. Add MUI Tab imports and EndpointTestPanel import
2. Add local tab state
3. Wrap existing form in conditional render based on tab
4. Add tabs between drawer header and content
5. Only show DrawerActions on Configure tab

**Full modified component** — replace the existing content starting from the imports. The key changes are marked with `// NEW`:

Add to imports:
```typescript
import { Tab, Tabs } from '@mui/material'  // NEW
import { EndpointTestPanel } from '@TAF/components/Endpoints/EndpointTestPanel'  // NEW
```

Add tab enum and state (inside the component, after `isEditMode`):
```typescript
// NEW: Tab state (Configure vs Test)
const [activeTab, setActiveTab] = useState<'configure' | 'test'>('configure')
```

Reset tab when drawer opens/endpoint changes — add to the `useEffect` that watches `endpoint`:
```typescript
setActiveTab('configure')
```

Also reset in `onClose`:
```typescript
setActiveTab('configure')
```

Replace the `<Drawer>` JSX — the `actions` prop should conditionally render:
```typescript
actions={
  activeTab === 'configure' ? (
    <DrawerActions
      actions={actions}
      form='endpoint-form'
      editing={isEditMode}
      loading={uiState.loading}
      disabled={uiState.loading || uiState.showDeleteConfirm}
    />
  ) : undefined
}
```

After the `<Drawer>` opening tag and before the `<form>`, add tabs:
```typescript
{isEditMode && (
  <Tabs
    value={activeTab}
    onChange={(_, val) => setActiveTab(val)}
    sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
  >
    <Tab label='Configure' value='configure' />
    <Tab label='Test' value='test' />
  </Tabs>
)}
```

Wrap the existing `<form>` in `{activeTab === 'configure' && (...)}`.

Add the test panel:
```typescript
{activeTab === 'test' && endpoint && (
  <EndpointTestPanel
    projectId={projectId}
    endpointId={endpoint.id}
  />
)}
```

### Step 2: Run admin tests to verify no regressions

Run: `cd repos/admin && pnpm test`

Expected: All tests PASS

---

## Task 6: TypeScript Type Checks

### Step 1: Run type checks for admin repo

Run: `cd repos/admin && pnpm types`

Expected: No type errors

### Step 2: Run type checks across workspace

Run: `pnpm types` (from root)

Expected: No type errors across any sub-repo

---

## Task 7: Integration Test

**Files:**
- Create: `repos/integration/src/tier1/endpoint-test-panel.test.ts`

### Step 1: Write the integration test

This test validates that the `/proxy/:projectId/:endpointId` route (which the admin test panel calls) works correctly for both proxy and FaaS endpoint types.

Create `repos/integration/src/tier1/endpoint-test-panel.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { get, post, api } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { tryDelete } from '../utils/cleanup'
import { env } from '../utils/env'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: Endpoint Test Panel API Validation
 *
 * Validates the /proxy/:projectId/:endpointId route that the
 * admin EndpointTestPanel uses to test endpoints.
 * Tests both proxy and FaaS endpoint types with various HTTP methods.
 */
describe('Tier 1: Endpoint Test Panel API', () => {
  const ctx = readContext()
  const echoUrl = env.echoUrl

  let setupFailed = false
  let projectId = ''
  let proxyEpId = ''
  let quickstartResult: Record<string, any> = {}

  beforeAll(async () => {
    // Skip if no echo URL configured (endpoint execution needs a target)
    if (!echoUrl) {
      setupFailed = true
      return
    }

    // Quickstart to get a project
    const qsRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/quickstart`,
      {
        providerBrand: 'anthropic',
        apiKey: 'sk-test-fake-key-12345',
        projectName: uniqueName('EP Test Panel'),
        agentName: uniqueName('EP Test Agent'),
      }
    )

    if (qsRes.status !== 201 || !qsRes.data?.data?.project?.id) {
      setupFailed = true
      return
    }

    quickstartResult = qsRes.data.data
    projectId = quickstartResult.project.id

    // Create a proxy endpoint pointing to the echo service
    const epRes = await post<{ data: Record<string, any> }>(
      `/orgs/${ctx.orgId}/projects/${projectId}/endpoints`,
      {
        name: uniqueName('Test Panel Proxy'),
        path: `/test-panel-proxy-${Date.now()}`,
        type: 'proxy',
        method: 'all',
        projectId,
        options: { url: echoUrl },
      }
    )

    if (epRes.status !== 201 || !epRes.data?.data?.id) {
      setupFailed = true
      return
    }

    proxyEpId = epRes.data.data.id
  }, 30_000)

  afterAll(async () => {
    if (proxyEpId)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${proxyEpId}`)

    if (quickstartResult.endpoint?.id)
      await tryDelete(
        `/orgs/${ctx.orgId}/projects/${projectId}/endpoints/${quickstartResult.endpoint.id}`
      )
    if (quickstartResult.agent?.id)
      await tryDelete(`/orgs/${ctx.orgId}/agents/${quickstartResult.agent.id}`)
    if (quickstartResult.project?.id)
      await tryDelete(`/orgs/${ctx.orgId}/projects/${quickstartResult.project.id}`)
    if (quickstartResult.secret?.id)
      await tryDelete(`/orgs/${ctx.orgId}/secrets/${quickstartResult.secret.id}`)
    if (quickstartResult.provider?.id)
      await tryDelete(`/orgs/${ctx.orgId}/providers/${quickstartResult.provider.id}`)
  })

  // ── Test Panel Core Flow: method + headers + body ───────────

  test('GET request returns echo response', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${proxyEpId}`,
      { method: 'GET', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('GET')
  })

  test('POST request with JSON body returns echo with body', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const payload = { message: 'test panel', count: 42 }
    const res = await api<any>(
      `/proxy/${projectId}/${proxyEpId}`,
      {
        method: 'POST',
        rawPath: true,
        body: payload,
      }
    )

    expect(res.status).toBe(200)
    expect(res.data).toBeDefined()
    expect(res.data.method).toBe('POST')
  })

  test('PUT request forwards method correctly', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${proxyEpId}`,
      {
        method: 'PUT',
        rawPath: true,
        body: { updated: true },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data.method).toBe('PUT')
  })

  test('PATCH request forwards method correctly', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${proxyEpId}`,
      {
        method: 'PATCH',
        rawPath: true,
        body: { patched: true },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data.method).toBe('PATCH')
  })

  test('DELETE request forwards method correctly', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${proxyEpId}`,
      { method: 'DELETE', rawPath: true }
    )

    expect(res.status).toBe(200)
    expect(res.data.method).toBe('DELETE')
  })

  test('custom headers are forwarded to target', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${proxyEpId}`,
      {
        method: 'GET',
        rawPath: true,
        headers: { 'X-Test-Panel': 'custom-value' },
      }
    )

    expect(res.status).toBe(200)
    expect(res.data.headers).toBeDefined()
    expect(res.data.headers['x-test-panel']).toBe('custom-value')
  })

  // ── Error Scenarios ────────────────────────────────────────

  test('non-existent endpoint returns 404', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/00000000-0000-0000-0000-000000000000`,
      { method: 'GET', rawPath: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
  })

  test('unauthenticated request returns 401', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await api<any>(
      `/proxy/${projectId}/${proxyEpId}`,
      { method: 'GET', rawPath: true, noAuth: true }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })
})
```

### Step 2: Run integration tests

Run: `cd repos/integration && pnpm test -- src/tier1/endpoint-test-panel.test.ts`

Expected: All tests PASS (or skip if no echo URL configured)

---

## Task 8: Full Test Suite Verification

### Step 1: Run all admin unit tests

Run: `cd repos/admin && pnpm test`

Expected: All tests PASS

### Step 2: Run all integration tests

Run: `cd repos/integration && pnpm test`

Expected: All tests PASS, no regressions

---

## Summary

| Task | Files | Tests |
|------|-------|-------|
| 1. EndpointTestApi service | 2 new, 1 modified | 7 unit |
| 2. testEndpoint action | 2 new, 1 modified | 3 unit |
| 3. useEndpointTest hook | 2 new | 10 unit |
| 4. EndpointTestPanel component | 1 new | — |
| 5. EndpointDrawer tabs | 1 modified | — |
| 6. Type checks | — | type-check |
| 7. Integration test | 1 new | 8 integration |
| 8. Full verification | — | all suites |

**Totals:** 8 new files, 3 modified files, ~28 tests
