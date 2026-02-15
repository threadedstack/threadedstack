import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockStream = vi.fn()

vi.mock(`@anthropic-ai/sdk`, () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: mockStream,
      },
    })),
  }
})

import { AnthropicAdapter } from '@TAG/llm/anthropic'

/**
 * Helper to create an async iterable from an array of events
 * with an attached finalMessage method
 */
const createMockStream = (
  events: Record<string, unknown>[],
  finalMsg: Record<string, unknown> = { stop_reason: `end_turn` }
) => {
  const iterable = {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event
      }
    },
    finalMessage: vi.fn().mockResolvedValue(finalMsg),
  }
  return iterable
}

describe(`AnthropicAdapter`, () => {
  let adapter: AnthropicAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new AnthropicAdapter()
  })

  const baseConfig = {
    apiKey: `test-api-key`,
    model: `claude-sonnet-4-20250514`,
    provider: `anthropic` as const,
  }

  const baseMessages = [
    {
      role: `user` as const,
      content: [{ type: `text` as const, text: `Hello` }],
    },
  ]

  it(`should have provider set to 'anthropic'`, () => {
    expect(adapter.provider).toBe(`anthropic`)
  })

  describe(`text streaming`, () => {
    it(`should yield text events from content_block_delta with text_delta`, async () => {
      const stream = createMockStream([
        {
          type: `content_block_delta`,
          delta: { type: `text_delta`, text: `Hello` },
        },
        {
          type: `content_block_delta`,
          delta: { type: `text_delta`, text: ` world` },
        },
        { type: `message_stop` },
      ])

      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(events[0]).toEqual({ type: `text`, text: `Hello` })
      expect(events[1]).toEqual({ type: `text`, text: ` world` })
    })
  })

  describe(`tool call streaming`, () => {
    it(`should yield tool_call_start from content_block_start with tool_use`, async () => {
      const stream = createMockStream([
        {
          type: `content_block_start`,
          content_block: {
            type: `tool_use`,
            id: `tool_123`,
            name: `read_file`,
          },
        },
        { type: `message_stop` },
      ])

      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(
        baseMessages,
        [
          {
            name: `read_file`,
            description: `Reads a file`,
            inputSchema: {
              type: `object` as const,
              properties: { path: { type: `string` } },
              required: [`path`],
            },
          },
        ],
        baseConfig
      )) {
        events.push(event)
      }

      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `tool_123`,
        name: `read_file`,
      })
    })

    it(`should yield tool_call_args from content_block_delta with input_json_delta`, async () => {
      const stream = createMockStream([
        {
          type: `content_block_start`,
          content_block: {
            type: `tool_use`,
            id: `tool_456`,
            name: `write_file`,
          },
        },
        {
          type: `content_block_delta`,
          delta: { type: `input_json_delta`, partial_json: `{"path":` },
        },
        {
          type: `content_block_delta`,
          delta: { type: `input_json_delta`, partial_json: `"/tmp/test.txt"}` },
        },
        { type: `message_stop` },
      ])

      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(
        baseMessages,
        [
          {
            name: `write_file`,
            description: `Writes a file`,
            inputSchema: {
              type: `object` as const,
              properties: { path: { type: `string` } },
            },
          },
        ],
        baseConfig
      )) {
        events.push(event)
      }

      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `tool_456`,
        name: `write_file`,
      })
      expect(events[1]).toEqual({
        type: `tool_call_args`,
        id: `tool_456`,
        args: `{"path":`,
      })
      expect(events[2]).toEqual({
        type: `tool_call_args`,
        id: `tool_456`,
        args: `"/tmp/test.txt"}`,
      })
    })

    it(`should track currentToolId across multiple tool calls`, async () => {
      const stream = createMockStream([
        {
          type: `content_block_start`,
          content_block: { type: `tool_use`, id: `tool_a`, name: `tool_one` },
        },
        {
          type: `content_block_delta`,
          delta: { type: `input_json_delta`, partial_json: `{"a":1}` },
        },
        {
          type: `content_block_start`,
          content_block: { type: `tool_use`, id: `tool_b`, name: `tool_two` },
        },
        {
          type: `content_block_delta`,
          delta: { type: `input_json_delta`, partial_json: `{"b":2}` },
        },
        { type: `message_stop` },
      ])

      mockStream.mockReturnValue(stream)

      const tools = [
        {
          name: `tool_one`,
          description: `First tool`,
          inputSchema: { type: `object` as const, properties: {} },
        },
        {
          name: `tool_two`,
          description: `Second tool`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, tools, baseConfig)) {
        events.push(event)
      }

      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `tool_a`,
        name: `tool_one`,
      })
      expect(events[1]).toEqual({ type: `tool_call_args`, id: `tool_a`, args: `{"a":1}` })
      expect(events[2]).toEqual({
        type: `tool_call_start`,
        id: `tool_b`,
        name: `tool_two`,
      })
      expect(events[3]).toEqual({ type: `tool_call_args`, id: `tool_b`, args: `{"b":2}` })
    })
  })

  describe(`done event and stop_reason mappings`, () => {
    it(`should map end_turn stop_reason to end_turn`, async () => {
      const stream = createMockStream([{ type: `message_stop` }], {
        stop_reason: `end_turn`,
      })
      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(events[0]).toEqual({ type: `done`, stopReason: `end_turn` })
    })

    it(`should map tool_use stop_reason to tool_use`, async () => {
      const stream = createMockStream([{ type: `message_stop` }], {
        stop_reason: `tool_use`,
      })
      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(events[0]).toEqual({ type: `done`, stopReason: `tool_use` })
    })

    it(`should map max_tokens stop_reason to max_tokens`, async () => {
      const stream = createMockStream([{ type: `message_stop` }], {
        stop_reason: `max_tokens`,
      })
      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(events[0]).toEqual({ type: `done`, stopReason: `max_tokens` })
    })

    it(`should default unknown stop_reason to end_turn`, async () => {
      const stream = createMockStream([{ type: `message_stop` }], {
        stop_reason: `some_unknown_reason`,
      })
      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(events[0]).toEqual({ type: `done`, stopReason: `end_turn` })
    })
  })

  describe(`system prompt handling`, () => {
    it(`should use config.systemPrompt when provided`, async () => {
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const config = { ...baseConfig, systemPrompt: `You are a helpful assistant` }

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], config)) {
        events.push(event)
      }

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          system: `You are a helpful assistant`,
        })
      )
    })

    it(`should extract system prompt from messages when config.systemPrompt is not set`, async () => {
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const messagesWithSystem = [
        {
          role: `system` as const,
          content: [
            { type: `text` as const, text: `You are a bot` },
            { type: `text` as const, text: `Be concise` },
          ],
        },
        {
          role: `user` as const,
          content: [{ type: `text` as const, text: `Hi` }],
        },
      ]

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(messagesWithSystem, [], baseConfig)) {
        events.push(event)
      }

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          system: `You are a bot\nBe concise`,
        })
      )
    })

    it(`should filter system messages from the messages array sent to Anthropic`, async () => {
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const messagesWithSystem = [
        {
          role: `system` as const,
          content: [{ type: `text` as const, text: `System prompt` }],
        },
        {
          role: `user` as const,
          content: [{ type: `text` as const, text: `Hello` }],
        },
      ]

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(messagesWithSystem, [], baseConfig)) {
        events.push(event)
      }

      const callArgs = mockStream.mock.calls[0][0]
      const sentMessages = callArgs.messages
      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0].role).toBe(`user`)
    })
  })

  describe(`client configuration`, () => {
    it(`should pass model and default max_tokens when maxTokens not set`, async () => {
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: `claude-sonnet-4-20250514`,
          max_tokens: 4096,
        })
      )
    })

    it(`should use provided maxTokens and temperature`, async () => {
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const config = { ...baseConfig, maxTokens: 2048, temperature: 0.5 }

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], config)) {
        events.push(event)
      }

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
          temperature: 0.5,
        })
      )
    })

    it(`should not pass tools when tools array is empty`, async () => {
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: undefined,
        })
      )
    })

    it(`should pass converted tools when tools are provided`, async () => {
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const tools = [
        {
          name: `my_tool`,
          description: `Does something`,
          inputSchema: {
            type: `object` as const,
            properties: {
              arg1: { type: `string`, description: `An argument` },
            },
            required: [`arg1`],
          },
        },
      ]

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, tools, baseConfig)) {
        events.push(event)
      }

      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              name: `my_tool`,
              description: `Does something`,
              input_schema: {
                type: `object`,
                properties: {
                  arg1: { type: `string`, description: `An argument` },
                },
                required: [`arg1`],
              },
            },
          ],
        })
      )
    })
  })

  describe(`custom headers`, () => {
    it(`should pass config.headers as defaultHeaders to Anthropic constructor`, async () => {
      const Anthropic = (await import(`@anthropic-ai/sdk`)).default
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const config = {
        ...baseConfig,
        headers: { [`X-Custom`]: `custom-value`, [`X-Provider`]: `provider-value` },
      }

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], config)) {
        events.push(event)
      }

      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: `test-api-key`,
        defaultHeaders: {
          [`X-Custom`]: `custom-value`,
          [`X-Provider`]: `provider-value`,
        },
      })
    })

    it(`should pass undefined defaultHeaders when config.headers is undefined`, async () => {
      const Anthropic = (await import(`@anthropic-ai/sdk`)).default
      const stream = createMockStream([{ type: `message_stop` }])
      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: `test-api-key`,
        defaultHeaders: undefined,
      })
    })
  })

  describe(`content_block_start for non-tool blocks`, () => {
    it(`should ignore content_block_start events that are not tool_use`, async () => {
      const stream = createMockStream([
        {
          type: `content_block_start`,
          content_block: { type: `text`, text: `` },
        },
        {
          type: `content_block_delta`,
          delta: { type: `text_delta`, text: `Some text` },
        },
        { type: `message_stop` },
      ])

      mockStream.mockReturnValue(stream)

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, [], baseConfig)) {
        events.push(event)
      }

      expect(events[0]).toEqual({ type: `text`, text: `Some text` })
      expect(events[1]).toEqual({ type: `done`, stopReason: `end_turn` })
      expect(events).toHaveLength(2)
    })
  })

  describe(`full streaming sequence`, () => {
    it(`should handle a mixed sequence of text and tool events`, async () => {
      const stream = createMockStream(
        [
          {
            type: `content_block_delta`,
            delta: { type: `text_delta`, text: `Let me help.` },
          },
          {
            type: `content_block_start`,
            content_block: { type: `tool_use`, id: `call_1`, name: `search` },
          },
          {
            type: `content_block_delta`,
            delta: { type: `input_json_delta`, partial_json: `{"query":"test"}` },
          },
          { type: `message_stop` },
        ],
        { stop_reason: `tool_use` }
      )

      mockStream.mockReturnValue(stream)

      const tools = [
        {
          name: `search`,
          description: `Search for something`,
          inputSchema: { type: `object` as const, properties: {} },
        },
      ]

      const events: Record<string, unknown>[] = []
      for await (const event of adapter.stream(baseMessages, tools, baseConfig)) {
        events.push(event)
      }

      expect(events).toEqual([
        { type: `text`, text: `Let me help.` },
        { type: `tool_call_start`, id: `call_1`, name: `search` },
        { type: `tool_call_args`, id: `call_1`, args: `{"query":"test"}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })
  })
})
