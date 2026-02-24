import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
    refreshAndRetry: vi.fn(),
  },
}))

// Unmock api.ts so we get the real BaseApi / apiService
vi.mock(`@TAF/services/api`, async () => {
  const actual = await vi.importActual<typeof import('./api')>(`@TAF/services/api`)
  return actual
})

describe(`EndpointTestApi`, () => {
  let mockFetch: ReturnType<typeof vi.fn>

  const defaultHeaders = {
    Accept: `application/json`,
    'Content-Type': `application/json`,
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    vi.stubGlobal(`fetch`, mockFetch)

    // Reset shared singleton header state to prevent bleed between tests
    const { endpointTestApi } = await import(`./endpointTestApi`)
    endpointTestApi.api.options.headers = { ...defaultHeaders }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const loadModule = async () => {
    const mod = await import(`./endpointTestApi`)
    return mod
  }

  const makeResponse = (
    status: number,
    body: string = ``,
    contentType: string = `application/json`
  ) =>
    new Response(body, {
      status,
      statusText: status < 400 ? `OK` : `Error`,
      headers: { [`Content-Type`]: contentType },
    })

  describe(`URL construction`, () => {
    it(`should construct the correct URL from projectId and endpointId`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{"ok":true}`))
      const { endpointTestApi } = await loadModule()

      await endpointTestApi.execute(`proj-1`, `ep-1`, { method: `GET` })

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://test.local/proxy/proj-1/ep-1`)
    })

    it(`should strip trailing slash from base URL`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      await endpointTestApi.execute(`p2`, `e2`, { method: `GET` })

      const [url] = mockFetch.mock.calls[0]
      expect(url).not.toContain(`//proxy`)
      expect(url).toBe(`https://test.local/proxy/p2/e2`)
    })
  })

  describe(`HTTP method forwarding`, () => {
    it.each([`GET`, `POST`, `PUT`, `PATCH`, `DELETE`])(
      `should forward %s method`,
      async (method) => {
        mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
        const { endpointTestApi } = await loadModule()

        await endpointTestApi.execute(`p`, `e`, { method })

        const [, opts] = mockFetch.mock.calls[0]
        expect(opts.method).toBe(method)
      }
    )
  })

  describe(`header handling`, () => {
    it(`should include auth headers from apiService`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      // Set auth header on the shared apiService
      endpointTestApi.api.options.headers = {
        ...endpointTestApi.api.options.headers,
        Authorization: `Bearer my-token`,
      }

      await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers.Authorization).toBe(`Bearer my-token`)
    })

    it(`should merge custom headers with auth headers`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      endpointTestApi.api.options.headers = {
        ...endpointTestApi.api.options.headers,
        Authorization: `Bearer my-token`,
      }

      await endpointTestApi.execute(`p`, `e`, {
        method: `POST`,
        headers: { 'X-Custom': `custom-value` },
      })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers.Authorization).toBe(`Bearer my-token`)
      expect(opts.headers[`X-Custom`]).toBe(`custom-value`)
    })

    it(`should allow custom headers to override auth headers`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      endpointTestApi.api.options.headers = {
        ...endpointTestApi.api.options.headers,
        Authorization: `Bearer original`,
      }

      await endpointTestApi.execute(`p`, `e`, {
        method: `GET`,
        headers: { Authorization: `Bearer overridden` },
      })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers.Authorization).toBe(`Bearer overridden`)
    })

    it(`should work without auth header set`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      // Clear any Authorization header
      const { Authorization, ...rest } = endpointTestApi.api.options.headers || {}
      endpointTestApi.api.options.headers = rest

      await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers.Authorization).toBeUndefined()
    })
  })

  describe(`body forwarding`, () => {
    it(`should forward request body when provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      const body = JSON.stringify({ key: `value` })
      await endpointTestApi.execute(`p`, `e`, { method: `POST`, body })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.body).toBe(body)
    })

    it(`should not include body when not provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.body).toBeUndefined()
    })

    it(`should not include body when empty string`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, `{}`))
      const { endpointTestApi } = await loadModule()

      await endpointTestApi.execute(`p`, `e`, { method: `POST`, body: `` })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.body).toBeUndefined()
    })
  })

  describe(`response shape`, () => {
    it(`should return data with status, statusText, body, contentType, and timing`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, `{"result":"ok"}`, `application/json`)
      )
      const { endpointTestApi } = await loadModule()

      const result = await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data!.status).toBe(200)
      expect(result.data!.statusText).toBe(`OK`)
      expect(result.data!.body).toBe(`{"result":"ok"}`)
      expect(result.data!.contentType).toBe(`application/json`)
      expect(typeof result.data!.timing).toBe(`number`)
      expect(result.data!.timing).toBeGreaterThanOrEqual(0)
    })

    it(`should default contentType to text/plain when missing`, async () => {
      // Create a mock response where headers.get('content-type') returns null
      const res = {
        status: 200,
        statusText: `OK`,
        headers: { get: (name: string) => null },
        text: async () => `plain text`,
      }
      mockFetch.mockResolvedValueOnce(res)
      const { endpointTestApi } = await loadModule()

      const result = await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      expect(result.data!.contentType).toBe(`text/plain`)
    })
  })

  describe(`error status codes returned as data`, () => {
    it(`should return 4xx responses as data, not error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, `Not Found`))
      const { endpointTestApi } = await loadModule()

      const result = await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data!.status).toBe(404)
      expect(result.data!.body).toBe(`Not Found`)
    })

    it(`should return 5xx responses as data, not error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, `Internal Server Error`))
      const { endpointTestApi } = await loadModule()

      const result = await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data!.status).toBe(500)
      expect(result.data!.body).toBe(`Internal Server Error`)
    })

    it(`should return 401 responses as data`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, `Unauthorized`))
      const { endpointTestApi } = await loadModule()

      const result = await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data!.status).toBe(401)
    })
  })

  describe(`network failures`, () => {
    it(`should return network errors as error property`, async () => {
      mockFetch.mockRejectedValueOnce(new TypeError(`Failed to fetch`))
      const { endpointTestApi } = await loadModule()

      const result = await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error!.message).toBe(`Failed to fetch`)
    })

    it(`should wrap non-Error throws as Error`, async () => {
      mockFetch.mockRejectedValueOnce(`string error`)
      const { endpointTestApi } = await loadModule()

      const result = await endpointTestApi.execute(`p`, `e`, { method: `GET` })

      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error!.message).toBe(`string error`)
    })
  })
})
