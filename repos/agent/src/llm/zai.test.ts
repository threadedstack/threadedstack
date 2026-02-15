import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TLLMAdapterConfig } from '@tdsk/domain'
import { ZaiAdapter } from './zai'

const createSSEResponse = (events: string[], status = 200): Response => {
  const body = events.join(`\n`) + `\n`
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })

  return new Response(stream, {
    status,
    statusText: status === 200 ? `OK` : `Error`,
    headers: { 'Content-Type': `text/event-stream` },
  })
}

const collectEvents = async (stream: AsyncIterable<unknown>) => {
  const events: unknown[] = []
  for await (const event of stream) {
    events.push(event)
  }
  return events
}

describe(`ZaiAdapter`, () => {
  let adapter: ZaiAdapter

  const baseConfig: TLLMAdapterConfig = {
    apiKey: `zai-test-key`,
    model: `glm-5`,
    provider: `zai` as any,
    temperature: 0.7,
  }

  const baseMessages = [
    {
      role: `user` as const,
      content: [{ type: `text` as const, text: `Hello` }],
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new ZaiAdapter()
  })

  it(`should have provider set to 'zai'`, () => {
    expect(adapter.provider).toBe(`zai`)
  })

  describe(`getBaseUrl`, () => {
    it(`should POST to z.ai API endpoint`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

      await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(fetchSpy).toHaveBeenCalledWith(
        `https://api.z.ai/api/paas/v4/chat/completions`,
        expect.any(Object)
      )
    })
  })

  describe(`getExtraBody`, () => {
    it(`should not add extra fields when options is empty`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

      await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toBeUndefined()
      expect(body.do_sample).toBeUndefined()
      expect(body.tool_stream).toBeUndefined()
    })

    it(`should add thinking mode when options.thinking is true`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
      const config = { ...baseConfig, options: { thinking: true } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toEqual({ type: `enabled`, budget_tokens: 2048 })
    })

    it(`should use custom thinkingBudget when provided`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
      const config = {
        ...baseConfig,
        options: { thinking: true, thinkingBudget: 4096 },
      }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toEqual({ type: `enabled`, budget_tokens: 4096 })
    })

    it(`should add do_sample:false when options.doSample is false`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
      const config = { ...baseConfig, options: { doSample: false } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.do_sample).toBe(false)
    })

    it(`should not add do_sample when doSample is not explicitly false`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
      const config = { ...baseConfig, options: { doSample: true } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.do_sample).toBeUndefined()
    })

    it(`should add tool_stream:true when options.toolStream is true`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
      const config = { ...baseConfig, options: { toolStream: true } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.tool_stream).toBe(true)
    })

    it(`should add web_search tool when options.webSearch is provided`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
      const config = {
        ...baseConfig,
        options: { webSearch: { search_engine: `search_pro_jina` } },
      }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.tools).toEqual([
        {
          type: `web_search`,
          web_search: { enable: true, search_engine: `search_pro_jina` },
        },
      ])
    })

    it(`should combine multiple options`, async () => {
      const fetchSpy = vi
        .spyOn(globalThis, `fetch`)
        .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
      const config = {
        ...baseConfig,
        options: { thinking: true, doSample: false, toolStream: true },
      }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toEqual({ type: `enabled`, budget_tokens: 2048 })
      expect(body.do_sample).toBe(false)
      expect(body.tool_stream).toBe(true)
    })
  })

  describe(`mapFinishReason`, () => {
    const testFinishReason = async (reason: string, expected: string) => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: reason }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))
      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
      expect(events).toEqual([{ type: `done`, stopReason: expected }])
    }

    it(`should map 'stop' to 'end_turn'`, () => testFinishReason(`stop`, `end_turn`))
    it(`should map 'tool_calls' to 'tool_use'`, () =>
      testFinishReason(`tool_calls`, `tool_use`))
    it(`should map 'length' to 'max_tokens'`, () =>
      testFinishReason(`length`, `max_tokens`))
    it(`should map 'sensitive' to 'error'`, () => testFinishReason(`sensitive`, `error`))
    it(`should map 'network_error' to 'error'`, () =>
      testFinishReason(`network_error`, `error`))
    it(`should map unknown to 'end_turn'`, () =>
      testFinishReason(`something_else`, `end_turn`))
  })

  describe(`streaming`, () => {
    it(`should stream text from z.ai SSE response`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: `GLM says hi` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `GLM says hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })
  })
})
