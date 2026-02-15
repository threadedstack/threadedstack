import { ProxyAdapter } from './proxy'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createMockResponse = (events: Array<Record<string, unknown>>) => {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(``)
  const body = lines + `data: [DONE]\n\n`
  const encoder = new TextEncoder()
  const chunks = [encoder.encode(body)]
  let index = 0

  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            return { done: false, value: chunks[index++] }
          }
          return { done: true, value: undefined }
        },
      }),
    },
  } as unknown as Response
}

describe(`ProxyAdapter`, () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    vi.stubGlobal(`fetch`, mockFetch)
  })

  it(`should have the correct provider`, () => {
    const adapter = new ProxyAdapter({
      backendUrl: `https://backend.test`,
      sessionToken: `token-abc`,
      provider: `anthropic`,
    })

    expect(adapter.provider).toBe(`anthropic`)
  })

  it(`should POST to /ai/chat with session token`, async () => {
    mockFetch.mockResolvedValue(createMockResponse([]))

    const adapter = new ProxyAdapter({
      backendUrl: `https://backend.test`,
      sessionToken: `token-abc`,
      provider: `anthropic`,
    })

    const messages = [
      { role: `user` as const, content: [{ type: `text` as const, text: `Hi` }] },
    ]
    const tools: any[] = []

    // Consume the async iterator
    for await (const _ of adapter.stream(messages, tools, {} as any)) {
      // no-op
    }

    expect(mockFetch).toHaveBeenCalledWith(`https://backend.test/ai/chat`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`,
        Authorization: `Session token-abc`,
      },
      body: JSON.stringify({ messages, tools }),
    })
  })

  it(`should yield parsed SSE events`, async () => {
    const events = [
      { type: `text`, text: `Hello ` },
      { type: `text`, text: `world` },
      { type: `done`, stopReason: `end_turn` },
    ]
    mockFetch.mockResolvedValue(createMockResponse(events))

    const adapter = new ProxyAdapter({
      backendUrl: `https://backend.test`,
      sessionToken: `token-abc`,
      provider: `anthropic`,
    })

    const received: any[] = []
    for await (const event of adapter.stream([], [], {} as any)) {
      received.push(event)
    }

    expect(received).toEqual(events)
  })

  it(`should stop at [DONE] sentinel`, async () => {
    const events = [{ type: `text`, text: `Partial` }]
    mockFetch.mockResolvedValue(createMockResponse(events))

    const adapter = new ProxyAdapter({
      backendUrl: `https://backend.test`,
      sessionToken: `tok`,
      provider: `openai`,
    })

    const received: any[] = []
    for await (const event of adapter.stream([], [], {} as any)) {
      received.push(event)
    }

    expect(received).toHaveLength(1)
    expect(received[0].text).toBe(`Partial`)
  })

  it(`should throw on non-OK response`, async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      body: null,
    })

    const adapter = new ProxyAdapter({
      backendUrl: `https://backend.test`,
      sessionToken: `bad-token`,
      provider: `anthropic`,
    })

    await expect(async () => {
      for await (const _ of adapter.stream([], [], {} as any)) {
        // no-op
      }
    }).rejects.toThrow(`LLM proxy error (401)`)
  })

  it(`should throw when response has no body`, async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    })

    const adapter = new ProxyAdapter({
      backendUrl: `https://backend.test`,
      sessionToken: `tok`,
      provider: `anthropic`,
    })

    await expect(async () => {
      for await (const _ of adapter.stream([], [], {} as any)) {
        // no-op
      }
    }).rejects.toThrow(`No response body from LLM proxy`)
  })

  it(`should ignore non-data lines in SSE`, async () => {
    const encoder = new TextEncoder()
    const body = `: comment\n\ndata: ${JSON.stringify({ type: `text`, text: `ok` })}\n\ndata: [DONE]\n\n`
    const chunks = [encoder.encode(body)]
    let index = 0

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => {
            if (index < chunks.length) {
              return { done: false, value: chunks[index++] }
            }
            return { done: true, value: undefined }
          },
        }),
      },
    })

    const adapter = new ProxyAdapter({
      backendUrl: `https://backend.test`,
      sessionToken: `tok`,
      provider: `anthropic`,
    })

    const received: any[] = []
    for await (const event of adapter.stream([], [], {} as any)) {
      received.push(event)
    }

    expect(received).toHaveLength(1)
    expect(received[0].text).toBe(`ok`)
  })
})
