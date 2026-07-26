import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryFetch = vi.fn((opts: any) => opts.queryFn())

vi.mock(`@TTH/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: vi.fn(),
  },
}))

vi.mock(`@TTH/services/auth`, () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { token: `test` }, user: { id: `u1` } },
    }),
  },
}))

vi.mock(`@TTH/utils/api/apiUrl`, () => ({
  apiUrl: () => `http://test.local`,
}))

vi.mock(`@TTH/services/query`, () => ({
  query: {
    fetch: (opts: any) => mockQueryFetch(opts),
    options: vi.fn((o: any) => o),
  },
}))

vi.unmock(`@TTH/services/api`)

import { Sandbox } from '@tdsk/domain'
import { sandboxApi } from './sandboxApi'

describe(`SandboxApi`, () => {
  let mockFetch: ReturnType<typeof vi.fn>

  const makeResponse = (status: number, body: any = {}) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status < 400 ? `OK` : `Error`,
      headers: { [`Content-Type`]: `application/json` },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    sandboxApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await sandboxApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/sandboxes`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into a Sandbox instance`, async () => {
      const rows = [
        { id: `sb-1`, name: `one`, orgId: `org-1` },
        { id: `sb-2`, name: `two`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await sandboxApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Sandbox)
      expect(resp.data![0].id).toBe(`sb-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await sandboxApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load Sandbox configs list' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Sandbox configs list`
      )
    })
  })

  describe(`connect()`, () => {
    it(`should POST the project-scoped connect path with the given opts`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { podName: `p1` } }))

      await sandboxApi.connect(`org-1`, `proj-1`, `sb-1`, { cols: 80, rows: 24 } as any)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/connect`
      )
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ cols: 80, rows: 24 })
    })

    it(`should default opts to {} when omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      await sandboxApi.connect(`org-1`, `proj-1`, `sb-1`)

      const [, init] = mockFetch.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({})
    })
  })

  describe(`sessions()`, () => {
    it(`should GET the project-scoped sessions path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await sandboxApi.sessions(`org-1`, `proj-1`, `sb-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/sessions`
      )
      expect(init.method).toBe(`GET`)
    })

    it(`should call _onError with 'Failed to load sessions' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.sessions(`org-1`, `proj-1`, `sb-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load sessions`
      )
    })
  })

  describe(`listInstances()`, () => {
    it(`should GET the project-scoped instances path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      await sandboxApi.listInstances(`org-1`, `proj-1`, `sb-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/instances`
      )
      expect(init.method).toBe(`GET`)
    })

    it(`should call _onError with 'Failed to load instances' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.listInstances(`org-1`, `proj-1`, `sb-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load instances`
      )
    })
  })

  describe(`stop()`, () => {
    it(`should DELETE the project-scoped stop path with instanceId/force/stopAll`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await sandboxApi.stop(`org-1`, `proj-1`, `sb-1`, `inst-1`, true, false)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/stop`
      )
      expect(init.method).toBe(`DELETE`)
      expect(JSON.parse(init.body)).toEqual({
        instanceId: `inst-1`,
        force: true,
        stopAll: false,
      })
    })

    it(`should suppress _onError on a 409 conflict response`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(409, { error: `already stopping` }))

      const resp = await sandboxApi.stop(`org-1`, `proj-1`, `sb-1`)

      expect(resp.error?.status).toBe(409)
      expect(onErrorSpy).not.toHaveBeenCalled()
    })

    it(`should call _onError for a non-409 error response`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await sandboxApi.stop(`org-1`, `proj-1`, `sb-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to stop sandbox`)
    })
  })

  describe(`exec()`, () => {
    it(`should POST the project-scoped exec path with the given data`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      await sandboxApi.exec(`org-1`, `proj-1`, `sb-1`, {
        command: `ls`,
        args: [`-la`],
        instanceId: `inst-1`,
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/exec`
      )
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({
        command: `ls`,
        args: [`-la`],
        instanceId: `inst-1`,
      })
    })
  })

  describe(`fileOp()`, () => {
    it(`should POST the project-scoped file path with the given data`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      const fileChange = { path: `/a.txt`, action: `write`, content: `hi` } as any
      await sandboxApi.fileOp(`org-1`, `proj-1`, `sb-1`, {
        fileChange,
        instanceId: `inst-1`,
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/file`
      )
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ fileChange, instanceId: `inst-1` })
    })
  })

  describe(`listPorts()`, () => {
    it(`should GET the project-scoped ports path with instanceId as query data`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await sandboxApi.listPorts(`org-1`, `proj-1`, `sb-1`, `inst-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/ports?instanceId=inst-1`
      )
      expect(init.method).toBe(`GET`)
    })

    it(`should call _onError with 'Failed to load ports' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.listPorts(`org-1`, `proj-1`, `sb-1`, `inst-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load ports`)
    })
  })

  describe(`exposePort()`, () => {
    it(`should POST the project-scoped ports path with the given data`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      await sandboxApi.exposePort(`org-1`, `proj-1`, `sb-1`, {
        instanceId: `inst-1`,
        port: 8080,
        protocol: `http` as any,
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/ports`
      )
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({
        instanceId: `inst-1`,
        port: 8080,
        protocol: `http`,
      })
    })

    it(`should call _onError with 'Failed to expose port' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.exposePort(`org-1`, `proj-1`, `sb-1`, {
        instanceId: `inst-1`,
        port: 8080,
      })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to expose port`)
    })
  })

  describe(`removePort()`, () => {
    it(`should DELETE the project-scoped port path with instanceId as data`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await sandboxApi.removePort(`org-1`, `proj-1`, `sb-1`, 8080, `inst-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/ports/8080`
      )
      expect(init.method).toBe(`DELETE`)
      expect(JSON.parse(init.body)).toEqual({ instanceId: `inst-1` })
    })

    it(`should call _onError with 'Failed to remove port' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.removePort(`org-1`, `proj-1`, `sb-1`, 8080, `inst-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to remove port`)
    })
  })

  describe(`monitorToken()`, () => {
    it(`should POST the org-scoped monitor token path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { token: `tok` } }))

      await sandboxApi.monitorToken(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/sandboxes/monitor/token`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({})
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['sandboxes']`, () => {
      expect(sandboxApi.cache.all()).toEqual([`sandboxes`])
    })

    it(`cache.list(orgId) extends cache.all() with ['list', orgId]`, () => {
      expect(sandboxApi.cache.list(`org-1`)).toEqual([`sandboxes`, `list`, `org-1`])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(sandboxApi.cache.detail(`sb-1`)).toEqual([`sandboxes`, `detail`, `sb-1`])
    })
  })
})
