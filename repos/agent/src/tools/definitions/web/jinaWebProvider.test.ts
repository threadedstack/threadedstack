import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JinaWebProvider } from './jinaWebProvider'

const mockFetch = (impl: any) => {
  globalThis.fetch = vi.fn().mockResolvedValue(impl) as any
}
const mockFetchReject = (err: Error) => {
  globalThis.fetch = vi.fn().mockRejectedValue(err) as any
}

describe(`JinaWebProvider`, () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe(`search`, () => {
    it(`should call Jina search API and return parsed results`, async () => {
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                title: `Vitest Docs`,
                url: `https://vitest.dev`,
                description: `Next generation testing framework`,
                content: `Full content here`,
              },
              {
                title: `Vitest GitHub`,
                url: `https://github.com/vitest-dev/vitest`,
                description: `GitHub repo`,
                content: `Repo content`,
              },
            ],
          }),
      })

      const provider = new JinaWebProvider()
      const results = await provider.search(`vitest`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `https://s.jina.ai/?q=vitest`,
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: `application/json` }),
        })
      )
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        title: `Vitest Docs`,
        url: `https://vitest.dev`,
        snippet: `Next generation testing framework`,
      })
    })

    it(`should limit results to maxResults`, async () => {
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { title: `A`, url: `https://a.com`, description: `a`, content: `` },
              { title: `B`, url: `https://b.com`, description: `b`, content: `` },
              { title: `C`, url: `https://c.com`, description: `c`, content: `` },
            ],
          }),
      })

      const provider = new JinaWebProvider()
      const results = await provider.search(`test`, 2)
      expect(results).toHaveLength(2)
    })

    it(`should include Authorization header when apiKey is provided`, async () => {
      mockFetch({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      const provider = new JinaWebProvider({ apiKey: `jina_test_key` })
      await provider.search(`test`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer jina_test_key`,
          }),
        })
      )
    })

    it(`should return empty array on non-ok response`, async () => {
      mockFetch({
        ok: false,
        status: 429,
        statusText: `Too Many Requests`,
      })

      const provider = new JinaWebProvider()
      const results = await provider.search(`test`)
      expect(results).toEqual([])
    })

    it(`should return empty array on network error`, async () => {
      mockFetchReject(new Error(`Network error`))

      const provider = new JinaWebProvider()
      const results = await provider.search(`test`)
      expect(results).toEqual([])
    })
  })

  describe(`fetch`, () => {
    it(`should call Jina reader API and return parsed content`, async () => {
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              title: `Example Page`,
              url: `https://example.com`,
              content: `Page content in markdown`,
            },
          }),
      })

      const provider = new JinaWebProvider()
      const result = await provider.fetch(`https://example.com`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `https://r.jina.ai/https://example.com`,
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: `application/json` }),
        })
      )
      expect(result).toEqual({
        url: `https://example.com`,
        title: `Example Page`,
        content: `Page content in markdown`,
        contentLength: 24,
      })
    })

    it(`should truncate content to maxLength`, async () => {
      const longContent = `x`.repeat(100)
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              title: `Long Page`,
              url: `https://example.com`,
              content: longContent,
            },
          }),
      })

      const provider = new JinaWebProvider()
      const result = await provider.fetch(`https://example.com`, { maxLength: 50 })

      expect(result.content).toBe(
        `x`.repeat(50) + `\n\n[Content truncated at 50 characters]`
      )
      expect(result.contentLength).toBe(100)
    })

    it(`should throw on non-ok response`, async () => {
      mockFetch({
        ok: false,
        status: 404,
        statusText: `Not Found`,
      })

      const provider = new JinaWebProvider()
      await expect(provider.fetch(`https://example.com/missing`)).rejects.toThrow(
        `Fetch failed: 404 Not Found`
      )
    })

    it(`should throw on network error`, async () => {
      mockFetchReject(new Error(`Connection refused`))

      const provider = new JinaWebProvider()
      await expect(provider.fetch(`https://example.com`)).rejects.toThrow(
        `Connection refused`
      )
    })

    it(`should include Authorization header when apiKey is provided`, async () => {
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { title: `Page`, url: `https://example.com`, content: `text` },
          }),
      })

      const provider = new JinaWebProvider({ apiKey: `jina_key_123` })
      await provider.fetch(`https://example.com`)

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer jina_key_123`,
          }),
        })
      )
    })
  })
})
