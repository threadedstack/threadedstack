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

  it(`should have type discriminant set to jina`, () => {
    const provider = new JinaWebProvider()
    expect(provider.type).toBe(`jina`)
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

    it(`should pass AbortSignal timeout to fetch`, async () => {
      mockFetch({ ok: true, json: () => Promise.resolve({ data: [] }) })
      const provider = new JinaWebProvider()
      await provider.search(`test`)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
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

    it(`should log warning on non-ok response`, async () => {
      const { logger } = await import('@TAG/utils/logger')
      const warnSpy = vi.spyOn(logger, `warn`).mockImplementation(() => {})
      mockFetch({ ok: false, status: 429, statusText: `Too Many Requests` })
      const provider = new JinaWebProvider()
      await provider.search(`test`)
      expect(warnSpy).toHaveBeenCalledWith(`Jina search failed: 429 Too Many Requests`)
      warnSpy.mockRestore()
    })

    it(`should return empty array on network error`, async () => {
      mockFetchReject(new Error(`Network error`))

      const provider = new JinaWebProvider()
      const results = await provider.search(`test`)
      expect(results).toEqual([])
    })

    it(`should log warning on network error`, async () => {
      const { logger } = await import('@TAG/utils/logger')
      const warnSpy = vi.spyOn(logger, `warn`).mockImplementation(() => {})
      mockFetchReject(new Error(`Network error`))
      const provider = new JinaWebProvider()
      await provider.search(`test`)
      expect(warnSpy).toHaveBeenCalledWith(`Jina search error: Network error`)
      warnSpy.mockRestore()
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

    it(`should throw when Jina reader returns no data`, async () => {
      mockFetch({ ok: true, json: () => Promise.resolve({}) })
      const provider = new JinaWebProvider()
      await expect(provider.fetch(`https://example.com`)).rejects.toThrow(
        `Jina reader returned no content`
      )
    })

    it(`should throw when Jina reader returns data without content`, async () => {
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({ data: { title: `Page`, url: `https://example.com` } }),
      })
      const provider = new JinaWebProvider()
      await expect(provider.fetch(`https://example.com`)).rejects.toThrow(
        `Jina reader returned no content`
      )
    })

    it(`should use fallback values when data.url and data.title are missing`, async () => {
      mockFetch({
        ok: true,
        json: () => Promise.resolve({ data: { content: `some content` } }),
      })
      const provider = new JinaWebProvider()
      const result = await provider.fetch(`https://example.com`)
      expect(result.url).toBe(`https://example.com`)
      expect(result.title).toBe(``)
    })

    it(`should pass AbortSignal timeout to fetch`, async () => {
      mockFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { title: `Page`, url: `https://example.com`, content: `text` },
          }),
      })
      const provider = new JinaWebProvider()
      await provider.fetch(`https://example.com`)
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      )
    })

    describe(`SSRF validation`, () => {
      it(`should reject private IP URLs`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`http://127.0.0.1/secret`)).rejects.toThrow(
          `Blocked URL host`
        )
        await expect(provider.fetch(`http://10.0.0.1/internal`)).rejects.toThrow(
          `Blocked URL host`
        )
        await expect(provider.fetch(`http://192.168.1.1/admin`)).rejects.toThrow(
          `Blocked URL host`
        )
        await expect(provider.fetch(`http://169.254.169.254/metadata`)).rejects.toThrow(
          `Blocked URL host`
        )
        await expect(provider.fetch(`http://172.16.0.1/internal`)).rejects.toThrow(
          `Blocked URL host`
        )
      })

      it(`should reject localhost`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`http://localhost/secret`)).rejects.toThrow(
          `Blocked URL host`
        )
      })

      it(`should reject non-http protocols`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`file:///etc/passwd`)).rejects.toThrow(
          `Blocked URL protocol`
        )
        await expect(provider.fetch(`ftp://evil.com/file`)).rejects.toThrow(
          `Blocked URL protocol`
        )
      })

      it(`should reject invalid URLs`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`not-a-url`)).rejects.toThrow(`Invalid URL`)
      })

      it(`should not call fetch for blocked URLs`, async () => {
        mockFetch({
          ok: true,
          json: () => Promise.resolve({ data: { title: ``, url: ``, content: `x` } }),
        })
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`http://127.0.0.1/secret`)).rejects.toThrow()
        expect(globalThis.fetch).not.toHaveBeenCalled()
      })

      it(`should reject IPv6-mapped IPv4 addresses`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`http://[::ffff:127.0.0.1]/secret`)).rejects.toThrow(
          `Blocked URL host`
        )
        await expect(
          provider.fetch(`http://[::ffff:169.254.169.254]/metadata`)
        ).rejects.toThrow(`Blocked URL host`)
      })

      it(`should reject expanded IPv6 loopback`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`http://[0:0:0:0:0:0:0:1]/secret`)).rejects.toThrow(
          `Blocked URL host`
        )
      })

      it(`should reject decimal IP encoding`, async () => {
        const provider = new JinaWebProvider()
        // 2130706433 = 127.0.0.1 in decimal
        await expect(provider.fetch(`http://2130706433/secret`)).rejects.toThrow(
          `Blocked URL host`
        )
      })

      it(`should reject hex IP encoding`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`http://0x7f000001/secret`)).rejects.toThrow(
          `Blocked URL host`
        )
      })

      it(`should reject octal IP encoding`, async () => {
        const provider = new JinaWebProvider()
        await expect(provider.fetch(`http://0177.0.0.1/secret`)).rejects.toThrow(
          `Blocked URL host`
        )
      })
    })
  })
})
