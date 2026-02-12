import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock(`openai`, () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  }
})

import { OpenAIAdapter } from '@TAG/llm/openai'

/**
 * Helper to create an async iterable from an array of chunks
 */
const createMockStream = (chunks: unknown[]) => {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk
      }
    },
  }
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
    vi.clearAllMocks()
    adapter = new OpenAIAdapter()
  })

  it(`should have provider set to 'openai'`, () => {
    expect(adapter.provider).toBe(`openai`)
  })

  describe(`stream`, () => {
    it(`should yield text events for chunks with delta.content`, async () => {
      const chunks = [
        { choices: [{ delta: { content: `Hello` }, finish_reason: null }] },
        { choices: [{ delta: { content: ` world` }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: `stop` }] },
      ]
      mockCreate.mockResolvedValue(createMockStream(chunks))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hello` },
        { type: `text`, text: ` world` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should yield tool_call_start and tool_call_args events for tool calls`, async () => {
      const chunks = [
        {
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
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: `{"location":` },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: `"NYC"}` },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ delta: {}, finish_reason: `tool_calls` }],
        },
      ]
      mockCreate.mockResolvedValue(createMockStream(chunks))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `tool_call_start`, id: `call_abc123`, name: `get_weather` },
        { type: `tool_call_args`, id: `call_abc123`, args: `{"location":` },
        { type: `tool_call_args`, id: `call_abc123`, args: `"NYC"}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })

    it(`should handle multiple concurrent tool calls`, async () => {
      const chunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: `call_1`,
                    function: { name: `tool_a`, arguments: `` },
                  },
                  {
                    index: 1,
                    id: `call_2`,
                    function: { name: `tool_b`, arguments: `` },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
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
        },
        {
          choices: [{ delta: {}, finish_reason: `tool_calls` }],
        },
      ]
      mockCreate.mockResolvedValue(createMockStream(chunks))

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
      const chunks = [
        { choices: [] },
        { choices: [{ delta: { content: `Hi` }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: `stop` }] },
      ]
      mockCreate.mockResolvedValue(createMockStream(chunks))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    describe(`finish_reason mapping`, () => {
      it(`should map 'stop' to 'end_turn'`, async () => {
        const chunks = [{ choices: [{ delta: {}, finish_reason: `stop` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(events).toEqual([{ type: `done`, stopReason: `end_turn` }])
      })

      it(`should map 'tool_calls' to 'tool_use'`, async () => {
        const chunks = [{ choices: [{ delta: {}, finish_reason: `tool_calls` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(events).toEqual([{ type: `done`, stopReason: `tool_use` }])
      })

      it(`should map 'length' to 'max_tokens'`, async () => {
        const chunks = [{ choices: [{ delta: {}, finish_reason: `length` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(events).toEqual([{ type: `done`, stopReason: `max_tokens` }])
      })

      it(`should map unknown finish_reason to 'end_turn'`, async () => {
        const chunks = [{ choices: [{ delta: {}, finish_reason: `content_filter` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(events).toEqual([{ type: `done`, stopReason: `end_turn` }])
      })
    })

    describe(`params construction`, () => {
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

        const chunks = [{ choices: [{ delta: {}, finish_reason: `stop` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        await collectEvents(adapter.stream(baseMessages, tools, baseConfig))

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                type: `function`,
                function: {
                  name: `get_weather`,
                  description: `Get weather for a location`,
                  parameters: tools[0].inputSchema,
                },
              },
            ],
          })
        )
      })

      it(`should not include tools in params when tools array is empty`, async () => {
        const chunks = [{ choices: [{ delta: {}, finish_reason: `stop` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs).not.toHaveProperty(`tools`)
      })

      it(`should use default maxTokens of 4096 when not specified`, async () => {
        const configWithoutMaxTokens = {
          apiKey: `test-key`,
          model: `gpt-4`,
          provider: `openai` as const,
          temperature: 0.5,
        }
        const chunks = [{ choices: [{ delta: {}, finish_reason: `stop` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        await collectEvents(adapter.stream(baseMessages, [], configWithoutMaxTokens))

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            max_tokens: 4096,
          })
        )
      })

      it(`should use provided maxTokens when specified`, async () => {
        const configWithMaxTokens = {
          ...baseConfig,
          maxTokens: 2048,
        }
        const chunks = [{ choices: [{ delta: {}, finish_reason: `stop` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        await collectEvents(adapter.stream(baseMessages, [], configWithMaxTokens))

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            max_tokens: 2048,
          })
        )
      })

      it(`should pass model, temperature, and stream:true in params`, async () => {
        const chunks = [{ choices: [{ delta: {}, finish_reason: `stop` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: `gpt-4`,
            temperature: 0.7,
            stream: true,
          })
        )
      })

      it(`should instantiate OpenAI client with the provided apiKey`, async () => {
        const OpenAI = (await import(`openai`)).default
        const chunks = [{ choices: [{ delta: {}, finish_reason: `stop` }] }]
        mockCreate.mockResolvedValue(createMockStream(chunks))

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(OpenAI).toHaveBeenCalledWith({ apiKey: `test-api-key` })
      })
    })

    it(`should yield tool_call_start with empty name when function name is missing`, async () => {
      const chunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: `call_no_name`,
                    function: {},
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ delta: {}, finish_reason: `tool_calls` }],
        },
      ]
      mockCreate.mockResolvedValue(createMockStream(chunks))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `call_no_name`,
        name: ``,
      })
    })

    it(`should accumulate tool call arguments across multiple chunks`, async () => {
      const chunks = [
        {
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
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: `"query"` } }],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: `:"test"}` } }],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ delta: {}, finish_reason: `tool_calls` }],
        },
      ]
      mockCreate.mockResolvedValue(createMockStream(chunks))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      // The start event includes the first argument chunk
      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `call_accum`,
        name: `search`,
      })
      // The first args chunk from the start chunk
      expect(events[1]).toEqual({
        type: `tool_call_args`,
        id: `call_accum`,
        args: `{`,
      })
      // Subsequent argument chunks
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
