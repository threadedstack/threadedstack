import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@TAF/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: vi.fn(),
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

vi.unmock(`@TAF/services/api`)

import { filesApi } from './filesApi'

describe(`FilesApi`, () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let onErrorSpy: ReturnType<typeof vi.spyOn>
  let readerInstances: MockFileReader[]
  let OriginalFileReader: typeof FileReader

  const makeResponse = (status: number, body: any = {}) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status < 400 ? `OK` : `Error`,
      headers: { [`Content-Type`]: `application/json` },
    })

  class MockFileReader {
    result: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    readAsDataURL = vi.fn()

    constructor() {
      readerInstances.push(this)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    filesApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(filesApi, `_onError`).mockResolvedValue(undefined)

    readerInstances = []
    OriginalFileReader = globalThis.FileReader
    globalThis.FileReader = MockFileReader as any
  })

  afterEach(() => {
    globalThis.FileReader = OriginalFileReader
  })

  describe(`upload()`, () => {
    it(`should strip the data:*;base64, prefix before POSTing`, async () => {
      const row = {
        assetId: `a1`,
        fileName: `test.png`,
        fileType: `image/png`,
        fileSize: 100,
      }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const file = new File([`content`], `test.png`, { type: `image/png` })
      const uploadPromise = filesApi.upload(`org-1`, `agent-1`, `thread-1`, file)

      expect(readerInstances).toHaveLength(1)
      readerInstances[0].result = `data:image/png;base64,QUJD`
      readerInstances[0].onload!()

      const resp = await uploadPromise

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/agents/agent-1/threads/thread-1/files`
      )
      expect(init.method).toBe(`POST`)
      const body = JSON.parse(init.body)
      expect(body.data).toBe(`QUJD`)
      expect(body.fileName).toBe(`test.png`)
      expect(body.mimeType).toBe(`image/png`)
      expect(resp.data).toEqual(row)
    })

    it(`should pass a raw base64 string through unchanged when there is no comma`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      const file = new File([`content`], `raw.bin`, { type: `application/octet-stream` })
      const uploadPromise = filesApi.upload(`org-1`, `agent-1`, `thread-1`, file)

      readerInstances[0].result = `QUJDRUZH`
      readerInstances[0].onload!()

      await uploadPromise

      const [, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(init.body)
      expect(body.data).toBe(`QUJDRUZH`)
    })

    it(`should fall back to application/octet-stream when the file has no type`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      const file = new File([`content`], `notype`, { type: `` })
      const uploadPromise = filesApi.upload(`org-1`, `agent-1`, `thread-1`, file)

      readerInstances[0].result = `data:;base64,QUJD`
      readerInstances[0].onload!()

      await uploadPromise

      const [, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(init.body)
      expect(body.mimeType).toBe(`application/octet-stream`)
    })

    it(`should call _onError with 'Failed to upload file' and surface the error when the POST fails`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      const file = new File([`content`], `test.png`, { type: `image/png` })
      const uploadPromise = filesApi.upload(`org-1`, `agent-1`, `thread-1`, file)

      readerInstances[0].result = `data:image/png;base64,QUJD`
      readerInstances[0].onload!()

      const resp = await uploadPromise

      expect(resp.error).toBeDefined()
      expect(onErrorSpy).toHaveBeenCalledOnce()
      expect(onErrorSpy).toHaveBeenCalledWith(resp.error, `Failed to upload file`)
    })

    it(`should reject with 'Failed to read file' when FileReader errors`, async () => {
      const file = new File([`content`], `test.png`, { type: `image/png` })
      const uploadPromise = filesApi.upload(`org-1`, `agent-1`, `thread-1`, file)

      readerInstances[0].onerror!()

      await expect(uploadPromise).rejects.toThrow(`Failed to read file`)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
