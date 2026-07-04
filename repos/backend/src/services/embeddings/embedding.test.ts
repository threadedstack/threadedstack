import type { TApp } from '@TBE/types'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { EmbeddingService, resolveEmbeddingProvider } from './embedding'
import { MemoryMaxTextChars, MemoryEmbeddingDimensions } from '@tdsk/domain'

const mockResolveApiKey = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: vi.fn().mockImplementation(() => ({
    resolveApiKey: mockResolveApiKey,
  })),
}))

// ── HELPERS ──────────────────────────────────────────────────────────

const makeProvider = (overrides: Record<string, any> = {}) => ({
  id: `prov-1`,
  orgId: `org-1`,
  type: `ai`,
  brand: `openai`,
  secretId: `sec-1`,
  createdAt: `2026-01-01T00:00:00.000Z`,
  options: { embeddingModel: `text-embedding-3-small` },
  ...overrides,
})

const makeApp = (providers: any[]) => {
  const list = vi.fn().mockResolvedValue({ data: providers })
  const app = {
    locals: {
      db: { services: { provider: { list } } },
    },
  } as unknown as TApp
  return { app, list }
}

const jsonResponse = (body: any, ok = true, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

describe(`EmbeddingService`, () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock = vi.fn()
    vi.stubGlobal(`fetch`, fetchMock)
    mockResolveApiKey.mockResolvedValue(`sk-test-key`)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── resolveEmbeddingProvider ───────────────────────────────────────

  describe(`resolveEmbeddingProvider`, () => {
    it(`returns null when no ai provider has an embeddingModel`, async () => {
      const { app } = makeApp([
        makeProvider({ options: {} }),
        makeProvider({ id: `prov-2`, options: { embeddingModel: `  ` } }),
        makeProvider({ id: `prov-3`, type: `docker` }),
      ])
      const result = await resolveEmbeddingProvider(app.locals.db as any, `org-1`)
      expect(result).toBeNull()
    })

    it(`returns the earliest-created qualifying provider`, async () => {
      const { app } = makeApp([
        makeProvider({ id: `newer`, createdAt: `2026-05-01T00:00:00.000Z` }),
        makeProvider({ id: `older`, createdAt: `2026-01-01T00:00:00.000Z` }),
      ])
      const result = await resolveEmbeddingProvider(app.locals.db as any, `org-1`)
      expect(result?.id).toBe(`older`)
    })

    it(`returns null when the provider list errors`, async () => {
      const list = vi.fn().mockResolvedValue({ error: { message: `db down` } })
      const db = { services: { provider: { list } } }
      const result = await resolveEmbeddingProvider(db as any, `org-1`)
      expect(result).toBeNull()
    })
  })

  // ── embed: graceful degradation ────────────────────────────────────

  it(`returns nulls and never calls fetch when no provider resolves`, async () => {
    const { app } = makeApp([])
    const svc = new EmbeddingService(app)

    const out = await svc.embed([`a`, `b`], { orgId: `org-1` })

    expect(out).toEqual([null, null])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it(`returns nulls when no API key resolves`, async () => {
    mockResolveApiKey.mockResolvedValue(``)
    const { app } = makeApp([makeProvider()])
    const svc = new EmbeddingService(app)

    const out = await svc.embed([`a`], { orgId: `org-1` })

    expect(out).toEqual([null])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it(`returns nulls (never throws) when the embeddings request fails`, async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: `boom` }, false, 500))
    const { app } = makeApp([makeProvider()])
    const svc = new EmbeddingService(app)

    const out = await svc.embed([`a`, `b`], { orgId: `org-1` })

    expect(out).toEqual([null, null])
  })

  it(`returns an empty array for empty input without calling fetch`, async () => {
    const { app } = makeApp([makeProvider()])
    const svc = new EmbeddingService(app)

    const out = await svc.embed([], { orgId: `org-1` })

    expect(out).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ── embed: OpenAI ──────────────────────────────────────────────────

  describe(`OpenAI brand`, () => {
    it(`posts model/input/dimensions and maps embeddings by index`, async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          data: [
            { index: 1, embedding: [0.3, 0.4] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        })
      )
      const { app } = makeApp([makeProvider()])
      const svc = new EmbeddingService(app)

      const out = await svc.embed([`first`, `second`], { orgId: `org-1` })

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(`https://api.openai.com/v1/embeddings`)
      const body = JSON.parse(init.body)
      expect(body.model).toBe(`text-embedding-3-small`)
      expect(body.input).toEqual([`first`, `second`])
      expect(body.dimensions).toBe(MemoryEmbeddingDimensions)
      expect(init.headers.authorization).toBe(`Bearer sk-test-key`)
      // index mapping: out[0] from index 0, out[1] from index 1
      expect(out).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ])
    })

    it(`truncates each input to MemoryMaxTextChars`, async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [{ index: 0, embedding: [1] }] }))
      const { app } = makeApp([makeProvider()])
      const svc = new EmbeddingService(app)

      const long = `x`.repeat(MemoryMaxTextChars + 500)
      await svc.embed([long], { orgId: `org-1` })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.input[0]).toHaveLength(MemoryMaxTextChars)
    })

    it(`respects a provider-configured baseUrl`, async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: [{ index: 0, embedding: [1] }] }))
      const { app } = makeApp([
        makeProvider({
          options: {
            embeddingModel: `text-embedding-3-small`,
            baseUrl: `https://proxy.example.com/v1/`,
          },
        }),
      ])
      const svc = new EmbeddingService(app)

      await svc.embed([`a`], { orgId: `org-1` })

      expect(fetchMock.mock.calls[0][0]).toBe(`https://proxy.example.com/v1/embeddings`)
    })
  })

  // ── embed: Google ──────────────────────────────────────────────────

  describe(`Google brand`, () => {
    it(`posts batchEmbedContents with outputDimensionality and maps by order`, async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
        })
      )
      const { app } = makeApp([
        makeProvider({
          brand: `google`,
          options: { embeddingModel: `gemini-embedding-001` },
        }),
      ])
      const svc = new EmbeddingService(app)

      const out = await svc.embed([`first`, `second`], { orgId: `org-1` })

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(
        `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-001:batchEmbedContents`
      )
      const body = JSON.parse(init.body)
      expect(body.requests).toHaveLength(2)
      expect(body.requests[0].model).toBe(`models/gemini-embedding-001`)
      expect(body.requests[0].content.parts[0].text).toBe(`first`)
      expect(body.requests[0].outputDimensionality).toBe(MemoryEmbeddingDimensions)
      expect(init.headers[`x-goog-api-key`]).toBe(`sk-test-key`)
      expect(out).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ])
    })

    it(`returns null for a missing embedding slot`, async () => {
      fetchMock.mockResolvedValue(jsonResponse({ embeddings: [{ values: [0.1] }, {}] }))
      const { app } = makeApp([
        makeProvider({
          brand: `google`,
          options: { embeddingModel: `models/gemini-embedding-001` },
        }),
      ])
      const svc = new EmbeddingService(app)

      const out = await svc.embed([`a`, `b`], { orgId: `org-1` })
      expect(out).toEqual([[0.1], null])
    })
  })

  // ── embedOne ───────────────────────────────────────────────────────

  it(`embedOne returns the single vector`, async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ index: 0, embedding: [9, 8] }] }))
    const { app } = makeApp([makeProvider()])
    const svc = new EmbeddingService(app)

    const out = await svc.embedOne(`hello`, { orgId: `org-1` })
    expect(out).toEqual([9, 8])
  })

  it(`embedOne returns null when no provider resolves`, async () => {
    const { app } = makeApp([])
    const svc = new EmbeddingService(app)

    const out = await svc.embedOne(`hello`, { orgId: `org-1` })
    expect(out).toBeNull()
  })
})
