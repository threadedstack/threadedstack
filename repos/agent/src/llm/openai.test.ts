import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdapter } from '@TAG/llm/openai'

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

describe(`OpenAIAdapter`, () => {
  let adapter: OpenAIAdapter

  const baseConfig = {
    apiKey: `test-api-key`,
    model: `gpt-4`,
    provider: `openai` as const,
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
    adapter = new OpenAIAdapter()
  })

  it(`should have provider set to 'openai'`, () => {
    expect(adapter.provider).toBe(`openai`)
  })

  describe(`stream`, () => {
    it(`should yield text events for chunks with delta.content`, async () => {
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

    it(`should yield tool_call_start and tool_call_args events for tool calls`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: `call_abc123`,
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
                tool_calls: [{ index: 0, function: { arguments: `{"location":` } }],
              },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: `"NYC"}` } }],
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
        { type: `tool_call_start`, id: `call_abc123`, name: `get_weather` },
        { type: `tool_call_args`, id: `call_abc123`, args: `{"location":` },
        { type: `tool_call_args`, id: `call_abc123`, args: `"NYC"}` },
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

    describe(`finish_reason mapping`, () => {
      it(`should map 'stop' to 'end_turn'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `end_turn` }])
      })

      it(`should map 'tool_calls' to 'tool_use'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `tool_use` }])
      })

      it(`should map 'length' to 'max_tokens'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `length` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `max_tokens` }])
      })

      it(`should map unknown finish_reason to 'end_turn'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `content_filter` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `end_turn` }])
      })
    })

    describe(`params construction`, () => {
      it(`should POST to OpenAI chat completions URL`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(fetchSpy).toHaveBeenCalledWith(
          `https://api.openai.com/v1/chat/completions`,
          expect.any(Object)
        )
      })

      it(`should include tools in params when tools array is non-empty`, async () => {
        const tools = [
          {
            name: `get_weather`,
            description: `Get weather for a location`,
            inputSchema: {
              type: `object` as const,
              properties: {
                location: { type: `string`, description: `City name` },
              },
              required: [`location`],
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
              name: `get_weather`,
              description: `Get weather for a location`,
              parameters: tools[0].inputSchema,
            },
          },
        ])
      })

      it(`should not include tools in params when tools array is empty`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.tools).toBeUndefined()
      })

      it(`should use default maxTokens of 4096 when not specified`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))
        const configNoMax = {
          apiKey: `k`,
          model: `m`,
          provider: `openai` as const,
          temperature: 0.5,
        }

        await collectEvents(adapter.stream(baseMessages, [], configNoMax))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.max_tokens).toBe(4096)
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

      it(`should pass model, temperature, and stream:true in params`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.model).toBe(`gpt-4`)
        expect(body.temperature).toBe(0.7)
        expect(body.stream).toBe(true)
      })

      it(`should send Bearer token in Authorization header`, async () => {
        const fetchSpy = vi
          .spyOn(globalThis, `fetch`)
          .mockResolvedValue(createSSEResponse([`data: [DONE]`]))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const callArgs = fetchSpy.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)[`Authorization`]).toBe(
          `Bearer test-api-key`
        )
      })
    })

    it(`should yield tool_call_start with empty name when function name is missing`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [
            {
              delta: { tool_calls: [{ index: 0, id: `call_no_name`, function: {} }] },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `call_no_name`,
        name: ``,
      })
    })

    it(`should accumulate tool call arguments across multiple chunks`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: `call_accum`,
                    function: { name: `search`, arguments: `{` },
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
              delta: { tool_calls: [{ index: 0, function: { arguments: `"query"` } }] },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({
          choices: [
            {
              delta: { tool_calls: [{ index: 0, function: { arguments: `:"test"}` } }] },
              finish_reason: null,
            },
          ],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `call_accum`,
        name: `search`,
      })
      expect(events[1]).toEqual({ type: `tool_call_args`, id: `call_accum`, args: `{` })
      expect(events[2]).toEqual({
        type: `tool_call_args`,
        id: `call_accum`,
        args: `"query"`,
      })
      expect(events[3]).toEqual({
        type: `tool_call_args`,
        id: `call_accum`,
        args: `:"test"}`,
      })
    })
  })
})
