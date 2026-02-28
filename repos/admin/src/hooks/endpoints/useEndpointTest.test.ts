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
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
    )

    expect(result.current.request.method).toBe('GET')
    expect(result.current.request.headers).toHaveLength(1)
    expect(result.current.request.headers[0].key).toBe('Content-Type')
    expect(result.current.request.body).toBe('')
    expect(result.current.response).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should use method from opts', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ method: 'POST', projectId: 'p1', endpointId: 'e1' })
    )

    expect(result.current.request.method).toBe('POST')
  })

  it('should update body', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
    )

    act(() => result.current.setBody('{"test": true}'))

    expect(result.current.request.body).toBe('{"test": true}')
  })

  it('should add and remove headers', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
    )

    act(() => result.current.addHeader())
    expect(result.current.request.headers).toHaveLength(2)

    act(() => result.current.removeHeader(1))
    expect(result.current.request.headers).toHaveLength(1)
  })

  it('should update header key and value', async () => {
    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
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
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
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
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
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
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
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

  it('should reset loading to false when testEndpoint throws', async () => {
    mockTestEndpoint.mockRejectedValueOnce(new Error('Unexpected failure'))

    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
    )

    await act(async () => {
      await result.current.sendRequest().catch(() => {})
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.response).toBeNull()
  })

  it('should not send body for GET method', async () => {
    mockTestEndpoint.mockResolvedValueOnce({
      data: {
        status: 200,
        statusText: 'OK',
        body: '{}',
        contentType: 'application/json',
        timing: 10,
      },
    })

    const { useEndpointTest } = await import('./useEndpointTest')

    const { result } = renderHook(() =>
      useEndpointTest({ method: 'GET', projectId: 'p1', endpointId: 'e1' })
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
