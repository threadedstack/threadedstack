import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TLLMAdapterConfig, TAIMessage, TLLMToolDef } from '@tdsk/domain'
import {
  OpenAICompatibleAdapter,
  toOpenAIMessages,
  toOpenAITools,
} from './openai-compatible'

/**
 * Concrete test subclass — minimal overrides
 */
class TestAdapter extends OpenAICompatibleAdapter {
  readonly provider = `test-provider` as any

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return `https://api.test.com/v1`
  }
}

const baseConfig: TLLMAdapterConfig = {
  apiKey: `test-key`,
  model: `test-model`,
  provider: `openai` as const,
  temperature: 0.7,
}

const baseMessages: TAIMessage[] = [
  { role: `user`, content: [{ type: `text`, text: `Hello` }] },
]

/**
 * Helper to create a mock fetch Response with SSE body
 */
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

/**
 * Helper to collect all events from the adapter stream
 */
const collectEvents = async (stream: AsyncIterable<unknown>) => {
  const events: unknown[] = []
  for await (const event of stream) {
    events.push(event)
  }
  return events
}

describe(`toOpenAIMessages`, () => {
  it(`should convert system messages`, () => {
    const messages: TAIMessage[] = [
      { role: `system`, content: [{ type: `text`, text: `You are helpful` }] },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([{ role: `system`, content: `You are helpful` }])
  })

  it(`should convert user text messages`, () => {
    const messages: TAIMessage[] = [
      { role: `user`, content: [{ type: `text`, text: `Hi` }] },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([{ role: `user`, content: [{ type: `text`, text: `Hi` }] }])
  })

  it(`should convert user messages with tool results to separate tool messages`, () => {
    const messages: TAIMessage[] = [
      {
        role: `user`,
        content: [
          {
            type: `tool_result`,
            toolUseId: `call_123`,
            content: `result data`,
          },
        ],
      },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([
      { role: `tool`, tool_call_id: `call_123`, content: `result data` },
    ])
  })

  it(`should convert assistant messages with tool calls`, () => {
    const messages: TAIMessage[] = [
      {
        role: `assistant`,
        content: [
          {
            type: `tool_use`,
            id: `call_abc`,
            name: `get_weather`,
            input: { city: `NYC` },
          },
        ],
      },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([
      {
        role: `assistant`,
        content: null,
        tool_calls: [
          {
            id: `call_abc`,
            type: `function`,
            function: {
              name: `get_weather`,
              arguments: `{"city":"NYC"}`,
            },
          },
        ],
      },
    ])
  })

  it(`should join multiple system text parts with newline`, () => {
    const messages: TAIMessage[] = [
      {
        role: `system`,
        content: [
          { type: `text`, text: `Line 1` },
          { type: `text`, text: `Line 2` },
        ],
      },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([{ role: `system`, content: `Line 1\nLine 2` }])
  })
})

describe(`toOpenAITools`, () => {
  it(`should convert tool defs to OpenAI function format`, () => {
    const tools: TLLMToolDef[] = [
      {
        name: `search`,
        description: `Search the web`,
        inputSchema: {
          type: `object`,
          properties: {
            query: { type: `string`, description: `Search query` },
          },
          required: [`query`],
        },
      },
    ]
    const result = toOpenAITools(tools)
    expect(result).toEqual([
      {
        type: `function`,
        function: {
          name: `search`,
          description: `Search the web`,
          parameters: tools[0].inputSchema,
        },
      },
    ])
  })
})

describe(`OpenAICompatibleAdapter`, () => {
  let adapter: TestAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new TestAdapter()
  })

  it(`should have the provider property from the subclass`, () => {
    expect(adapter.provider).toBe(`test-provider`)
  })

  describe(`stream`, () => {
    it(`should yield text events for SSE chunks with delta.content`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hello` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: ` world` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hello` },
        { type: `text`, text: ` world` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should yield tool_call_start and tool_call_args events`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: `call_abc`,
                    function: { name: `get_weather`, arguments: `` },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: `{"city":"NYC"}` },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `tool_call_start`, id: `call_abc`, name: `get_weather` },
        { type: `tool_call_args`, id: `call_abc`, args: `{"city":"NYC"}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })

    it(`should handle multiple concurrent tool calls`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: `call_1`, function: { name: `tool_a`, arguments: `` } },
                  { index: 1, id: `call_2`, function: { name: `tool_b`, arguments: `` } },
                ],
              },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, function: { arguments: `{"a":1}` } },
                  { index: 1, function: { arguments: `{"b":2}` } },
                ],
              },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `tool_call_start`, id: `call_1`, name: `tool_a` },
        { type: `tool_call_start`, id: `call_2`, name: `tool_b` },
        { type: `tool_call_args`, id: `call_1`, args: `{"a":1}` },
        { type: `tool_call_args`, id: `call_2`, args: `{"b":2}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })

    it(`should skip SSE lines that are not data lines`, async () => {
      const sseEvents = [
        `: this is a comment`,
        `event: message`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hi` }, finish_reason: null }] })}`,
        ``,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should skip chunks with no choices`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hi` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should yield error event for non-OK response`, async () => {
      const res = new Response(`Unauthorized`, {
        status: 401,
        statusText: `Unauthorized`,
      })
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(res)

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `error`, error: `test-provider API error 401: Unauthorized` },
        { type: `done`, stopReason: `error` },
      ])
    })

    it(`should yield error event when response has no body`, async () => {
      const res = new Response(null, { status: 200 })
      Object.defineProperty(res, `body`, { value: null })
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(res)

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `error`, error: `No response body` },
        { type: `done`, stopReason: `error` },
      ])
    })

    describe(`finish_reason mapping`, () => {
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
      it(`should map unknown to 'end_turn'`, () =>
        testFinishReason(`content_filter`, `end_turn`))
    })

    describe(`request construction`, () => {
      it(`should POST to baseUrl/chat/completions`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(fetchSpy).toHaveBeenCalledWith(
          `https://api.test.com/v1/chat/completions`,
          expect.any(Object)
        )
      })

      it(`should send Authorization Bearer header`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const callArgs = fetchSpy.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)[`Authorization`]).toBe(
          `Bearer test-key`
        )
      })

      it(`should include model, max_tokens, temperature, stream in body`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.model).toBe(`test-model`)
        expect(body.max_tokens).toBe(4096)
        expect(body.temperature).toBe(0.7)
        expect(body.stream).toBe(true)
      })

      it(`should use provided maxTokens when specified`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(
          adapter.stream(baseMessages, [], { ...baseConfig, maxTokens: 2048 })
        )

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.max_tokens).toBe(2048)
      })

      it(`should include tools when tools array is non-empty`, async () => {
        const tools: TLLMToolDef[] = [
          {
            name: `search`,
            description: `Search`,
            inputSchema: {
              type: `object`,
              properties: { q: { type: `string` } },
            },
          },
        ]
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, tools, baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.tools).toEqual([
          {
            type: `function`,
            function: {
              name: `search`,
              description: `Search`,
              parameters: tools[0].inputSchema,
            },
          },
        ])
      })

      it(`should not include tools when tools array is empty`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.tools).toBeUndefined()
      })

      it(`should merge config.headers into fetch headers`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        const config = {
          ...baseConfig,
          headers: { 'X-Custom': `custom-value`, 'X-Another': `another-value` },
        }

        await collectEvents(adapter.stream(baseMessages, [], config))

        const callArgs = fetchSpy.mock.calls[0][1] as RequestInit
        const headers = callArgs.headers as Record<string, string>
        expect(headers[`X-Custom`]).toBe(`custom-value`)
        expect(headers[`X-Another`]).toBe(`another-value`)
        // Default headers still present
        expect(headers[`Content-Type`]).toBe(`application/json`)
        expect(headers[`Authorization`]).toBe(`Bearer test-key`)
      })

      it(`should allow config.headers to override default headers`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        const config = {
          ...baseConfig,
          headers: { Authorization: `ApiKey my-custom-auth` },
        }

        await collectEvents(adapter.stream(baseMessages, [], config))

        const callArgs = fetchSpy.mock.calls[0][1] as RequestInit
        const headers = callArgs.headers as Record<string, string>
        expect(headers[`Authorization`]).toBe(`ApiKey my-custom-auth`)
      })

      it(`should spread config.bodyParams into fetch body`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        const config = {
          ...baseConfig,
          bodyParams: { top_p: 0.9, seed: 42, custom_flag: true },
        }

        await collectEvents(adapter.stream(baseMessages, [], config))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.top_p).toBe(0.9)
        expect(body.seed).toBe(42)
        expect(body.custom_flag).toBe(true)
        // Standard fields still present
        expect(body.model).toBe(`test-model`)
        expect(body.stream).toBe(true)
      })

      it(`should not add extra body params when config.bodyParams is undefined`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.top_p).toBeUndefined()
        expect(body.seed).toBeUndefined()
      })

      it(`should not add extra headers when config.headers is undefined`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const callArgs = fetchSpy.mock.calls[0][1] as RequestInit
        const headers = callArgs.headers as Record<string, string>
        expect(Object.keys(headers)).toEqual([`Content-Type`, `Authorization`])
      })
    })
  })
})
