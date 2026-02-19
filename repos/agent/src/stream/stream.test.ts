import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Use vi.hoisted so variables are available when vi.mock factory runs ---
const { mockEvents, mockStream, mockCreateStream } = vi.hoisted(() => {
  const mockEvents: any[] = []
  const mockStream = {
    push: vi.fn((e: any) => mockEvents.push(e)),
    end: vi.fn(),
    [Symbol.asyncIterator]: async function* () {
      for (const e of mockEvents) yield e
    },
  }
  const mockCreateStream = vi.fn().mockReturnValue(mockStream)
  return { mockEvents, mockStream, mockCreateStream }
})

vi.mock(`@mariozechner/pi-ai`, () => {
  return {
    createAssistantMessageEventStream: mockCreateStream,
  }
})

import { createStreamProxy } from './stream'
import type { TProxyConfig } from '@TAG/types'

// --- Helpers ---
const createSSEResponse = (events: Record<string, unknown>[]) => {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(``)
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': `text/event-stream` },
  })
}

const config: TProxyConfig = {
  backendUrl: `http://localhost:5885`,
  sessionToken: `test-session-token-123`,
}

const model = {
  api: `anthropic-messages` as const,
  provider: `anthropic` as const,
  id: `claude-3`,
}

const context = {
  messages: [
    { role: `user` as const, content: [{ type: `text` as const, text: `Hello` }] },
  ],
  systemPrompt: `You are helpful`,
  tools: [] as any[],
}

/**
 * Helper: wait for the internal async IIFE to settle.
 * The stream fn fires an async IIFE; we flush microtasks + let the
 * ReadableStream reader finish before asserting.
 */
const flushStream = () => new Promise((r) => setTimeout(r, 50))

describe(`createStreamProxy`, () => {
  beforeEach(() => {
    mockEvents.length = 0
    mockStream.push.mockClear()
    mockStream.end.mockClear()
    mockCreateStream.mockClear()

    // Re-wire push so it still records into mockEvents
    mockStream.push.mockImplementation((e: any) => mockEvents.push(e))
    // Ensure createAssistantMessageEventStream always returns our mock
    mockCreateStream.mockReturnValue(mockStream)
  })

  it(`should return a function`, () => {
    const streamFn = createStreamProxy(config)
    expect(typeof streamFn).toBe(`function`)
  })

  it(`should POST to correct URL with Session header`, async () => {
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse([]))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe(`http://localhost:5885/ai/stream`)
    expect(opts.method).toBe(`POST`)
    expect(opts.headers[`Authorization`]).toBe(`Session test-session-token-123`)
    expect(opts.headers[`Content-Type`]).toBe(`application/json`)
  })

  it(`should include model, context, and options in body`, async () => {
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse([]))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any, { temperature: 0.7, maxTokens: 1024 } as any)

    await flushStream()

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toEqual(model)
    expect(body.context).toEqual(context)
    expect(body.options.temperature).toBe(0.7)
    expect(body.options.maxTokens).toBe(1024)
  })

  it(`should parse and push text_delta SSE events to stream`, async () => {
    const sseEvents = [
      { type: `start` },
      { type: `text_start`, contentIndex: 0 },
      { type: `text_delta`, contentIndex: 0, delta: `Hello` },
      { type: `text_delta`, contentIndex: 0, delta: ` world` },
      { type: `text_end`, contentIndex: 0 },
    ]
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    // start, text_start, text_delta x2, text_end = 5 pushes
    expect(mockStream.push).toHaveBeenCalledTimes(5)

    // Check the text_delta events
    const textDeltaCalls = mockStream.push.mock.calls.filter(
      ([evt]: any) => evt.type === `text_delta`
    )
    expect(textDeltaCalls).toHaveLength(2)
    expect(textDeltaCalls[0][0].delta).toBe(`Hello`)
    expect(textDeltaCalls[1][0].delta).toBe(` world`)

    // Verify text_end has accumulated content
    const textEndCall = mockStream.push.mock.calls.find(
      ([evt]: any) => evt.type === `text_end`
    )
    expect(textEndCall[0].content).toBe(`Hello world`)
  })

  it(`should parse done events with reason and usage`, async () => {
    const usage = {
      input: 10,
      output: 20,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 30,
      cost: { input: 0.01, output: 0.02, cacheRead: 0, cacheWrite: 0, total: 0.03 },
    }
    const sseEvents = [{ type: `start` }, { type: `done`, reason: `stop`, usage }]
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    const doneCall = mockStream.push.mock.calls.find(([evt]: any) => evt.type === `done`)
    expect(doneCall).toBeDefined()
    expect(doneCall[0].reason).toBe(`stop`)
    expect(doneCall[0].message.usage).toEqual(usage)
  })

  it(`should parse error events correctly`, async () => {
    const usage = {
      input: 5,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 5,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    }
    const sseEvents = [
      { type: `start` },
      { type: `error`, reason: `error`, errorMessage: `Rate limit exceeded`, usage },
    ]
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    const errorCall = mockStream.push.mock.calls.find(
      ([evt]: any) => evt.type === `error`
    )
    expect(errorCall).toBeDefined()
    expect(errorCall[0].reason).toBe(`error`)
    expect(errorCall[0].error.errorMessage).toBe(`Rate limit exceeded`)
    expect(errorCall[0].error.usage).toEqual(usage)
  })

  it(`should skip unknown SSE lines without data: prefix`, async () => {
    // Build a custom response with mixed lines
    const body = [
      `: comment line`,
      `event: ping`,
      `data: ${JSON.stringify({ type: `start` })}`,
      `id: 123`,
      `retry: 5000`,
      `data: ${JSON.stringify({ type: `text_start`, contentIndex: 0 })}`,
      ``,
    ].join(`\n`)

    const response = new Response(body, {
      status: 200,
      headers: { 'Content-Type': `text/event-stream` },
    })
    const mockFetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    // Only data: lines should be processed: start + text_start
    expect(mockStream.push).toHaveBeenCalledTimes(2)
    expect(mockStream.push.mock.calls[0][0].type).toBe(`start`)
    expect(mockStream.push.mock.calls[1][0].type).toBe(`text_start`)
  })

  it(`should skip [DONE] sentinel`, async () => {
    const body = [`data: ${JSON.stringify({ type: `start` })}`, `data: [DONE]`, ``].join(
      `\n`
    )

    const response = new Response(body, {
      status: 200,
      headers: { 'Content-Type': `text/event-stream` },
    })
    const mockFetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    // Only the start event, not [DONE]
    expect(mockStream.push).toHaveBeenCalledTimes(1)
    expect(mockStream.push.mock.calls[0][0].type).toBe(`start`)
  })

  it(`should push error event on network failure`, async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error(`Network failure`))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    expect(mockStream.push).toHaveBeenCalledTimes(1)
    const errorEvent = mockStream.push.mock.calls[0][0]
    expect(errorEvent.type).toBe(`error`)
    expect(errorEvent.reason).toBe(`error`)
    expect(errorEvent.error.errorMessage).toBe(`Network failure`)
    expect(errorEvent.error.stopReason).toBe(`error`)
  })

  it(`should push error event on non-ok HTTP response`, async () => {
    const response = new Response(`Server Error`, { status: 500 })
    const mockFetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    expect(mockStream.push).toHaveBeenCalledTimes(1)
    const errorEvent = mockStream.push.mock.calls[0][0]
    expect(errorEvent.type).toBe(`error`)
    expect(errorEvent.error.errorMessage).toBe(`LLM proxy error (500)`)
  })

  it(`should call stream.end() after processing`, async () => {
    const sseEvents = [
      { type: `start` },
      {
        type: `done`,
        reason: `stop`,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      },
    ]
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    expect(mockStream.end).toHaveBeenCalledTimes(1)
  })

  it(`should call stream.end() after error`, async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error(`fail`))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any)

    await flushStream()

    expect(mockStream.end).toHaveBeenCalledTimes(1)
  })

  it(`should pass signal from options to fetch`, async () => {
    const controller = new AbortController()
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse([]))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any, { signal: controller.signal } as any)

    await flushStream()

    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal)
  })

  it(`should set reason to aborted when signal is aborted`, async () => {
    const controller = new AbortController()
    controller.abort()

    const mockFetch = vi.fn().mockRejectedValue(new DOMException(`Aborted`, `AbortError`))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    streamFn(model as any, context as any, { signal: controller.signal } as any)

    await flushStream()

    expect(mockStream.push).toHaveBeenCalledTimes(1)
    const errorEvent = mockStream.push.mock.calls[0][0]
    expect(errorEvent.type).toBe(`error`)
    expect(errorEvent.reason).toBe(`aborted`)
    expect(errorEvent.error.stopReason).toBe(`aborted`)
  })

  it(`should return the stream synchronously`, () => {
    const mockFetch = vi.fn().mockResolvedValue(createSSEResponse([]))
    vi.stubGlobal(`fetch`, mockFetch)

    const streamFn = createStreamProxy(config)
    const result = streamFn(model as any, context as any)

    // The stream is returned immediately (not a promise)
    expect(result).toBe(mockStream)
  })

  describe(`processProxyEvent coverage`, () => {
    it(`should handle thinking_start, thinking_delta, thinking_end events`, async () => {
      const sseEvents = [
        { type: `start` },
        { type: `thinking_start`, contentIndex: 0 },
        { type: `thinking_delta`, contentIndex: 0, delta: `Let me think` },
        { type: `thinking_end`, contentIndex: 0 },
      ]
      const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
      vi.stubGlobal(`fetch`, mockFetch)

      const streamFn = createStreamProxy(config)
      streamFn(model as any, context as any)

      await flushStream()

      expect(mockStream.push).toHaveBeenCalledTimes(4)

      const thinkingStart = mockStream.push.mock.calls.find(
        ([e]: any) => e.type === `thinking_start`
      )
      expect(thinkingStart).toBeDefined()

      const thinkingDelta = mockStream.push.mock.calls.find(
        ([e]: any) => e.type === `thinking_delta`
      )
      expect(thinkingDelta[0].delta).toBe(`Let me think`)

      const thinkingEnd = mockStream.push.mock.calls.find(
        ([e]: any) => e.type === `thinking_end`
      )
      expect(thinkingEnd[0].content).toBe(`Let me think`)
    })

    it(`should handle toolcall_start, toolcall_delta, toolcall_end events`, async () => {
      const sseEvents = [
        { type: `start` },
        { type: `toolcall_start`, contentIndex: 0, id: `tool-1`, toolName: `shellExec` },
        { type: `toolcall_delta`, contentIndex: 0, delta: `{"command":"ls"}` },
        { type: `toolcall_end`, contentIndex: 0 },
      ]
      const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
      vi.stubGlobal(`fetch`, mockFetch)

      const streamFn = createStreamProxy(config)
      streamFn(model as any, context as any)

      await flushStream()

      expect(mockStream.push).toHaveBeenCalledTimes(4)

      const toolStart = mockStream.push.mock.calls.find(
        ([e]: any) => e.type === `toolcall_start`
      )
      expect(toolStart).toBeDefined()

      const toolDelta = mockStream.push.mock.calls.find(
        ([e]: any) => e.type === `toolcall_delta`
      )
      expect(toolDelta[0].delta).toBe(`{"command":"ls"}`)

      const toolEnd = mockStream.push.mock.calls.find(
        ([e]: any) => e.type === `toolcall_end`
      )
      expect(toolEnd[0].toolCall).toEqual({
        type: `toolCall`,
        id: `tool-1`,
        name: `shellExec`,
        arguments: {},
      })
    })

    it(`should return undefined for text_delta on wrong content type`, async () => {
      // text_delta without preceding text_start (contentIndex mismatch)
      const sseEvents = [
        { type: `start` },
        { type: `text_delta`, contentIndex: 5, delta: `orphan` },
      ]
      const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
      vi.stubGlobal(`fetch`, mockFetch)

      const streamFn = createStreamProxy(config)
      streamFn(model as any, context as any)

      await flushStream()

      // Only the start event should be pushed; text_delta returns undefined
      expect(mockStream.push).toHaveBeenCalledTimes(1)
      expect(mockStream.push.mock.calls[0][0].type).toBe(`start`)
    })

    it(`should skip unknown event types`, async () => {
      const sseEvents = [
        { type: `start` },
        { type: `unknown_event_type`, data: `something` },
      ]
      const mockFetch = vi.fn().mockResolvedValue(createSSEResponse(sseEvents))
      vi.stubGlobal(`fetch`, mockFetch)

      const streamFn = createStreamProxy(config)
      streamFn(model as any, context as any)

      await flushStream()

      // Only start event pushed; unknown returns undefined
      expect(mockStream.push).toHaveBeenCalledTimes(1)
      expect(mockStream.push.mock.calls[0][0].type).toBe(`start`)
    })
  })
})
