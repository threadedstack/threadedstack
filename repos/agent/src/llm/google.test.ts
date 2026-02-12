import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  TAIMessage,
  TLLMToolDef,
  TLLMAdapterConfig,
  TStreamEvent,
} from '@tdsk/domain'

const mockGenerateContentStream = vi.fn()

const MockGoogleGenAI = vi.fn().mockImplementation(() => ({
  models: {
    generateContentStream: mockGenerateContentStream,
  },
}))

vi.mock(`@google/genai`, () => ({
  GoogleGenAI: MockGoogleGenAI,
}))

import { GoogleAdapter } from './google'

const collectEvents = async (
  iterable: AsyncIterable<TStreamEvent>
): Promise<TStreamEvent[]> => {
  const events: TStreamEvent[] = []
  for await (const event of iterable) {
    events.push(event)
  }
  return events
}

const createMockStream = (chunks: unknown[]) => {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk
      }
    },
  }
}

const baseConfig: TLLMAdapterConfig = {
  apiKey: `test-google-api-key`,
  model: `gemini-2.0-flash`,
  provider: `google`,
  maxTokens: 1024,
  temperature: 0.7,
}

const userMessage: TAIMessage = {
  role: `user`,
  content: [{ type: `text`, text: `Hello Google` }],
}

describe(`GoogleAdapter`, () => {
  let adapter: GoogleAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new GoogleAdapter()
  })

  it(`should have provider set to 'google'`, () => {
    expect(adapter.provider).toBe(`google`)
  })

  describe(`stream`, () => {
    it(`should instantiate GoogleGenAI with the provided apiKey`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))

      await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(MockGoogleGenAI).toHaveBeenCalledWith({ apiKey: `test-google-api-key` })
    })

    it(`should call generateContentStream with correct model and config`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))

      await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: `gemini-2.0-flash`,
          config: expect.objectContaining({
            maxOutputTokens: 1024,
            temperature: 0.7,
          }),
        })
      )
    })

    it(`should default maxOutputTokens to 4096 when maxTokens is undefined`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const config = { ...baseConfig, maxTokens: undefined }

      await collectEvents(adapter.stream([userMessage], [], config))

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            maxOutputTokens: 4096,
          }),
        })
      )
    })

    it(`should yield text events for text parts`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [{ text: `Hello from Gemini` }],
              },
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toContainEqual({
        type: `text`,
        text: `Hello from Gemini`,
      })
    })

    it(`should yield multiple text events for multiple text parts`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [{ text: `Part one` }],
              },
            },
          ],
        },
        {
          candidates: [
            {
              content: {
                parts: [{ text: ` Part two` }],
              },
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      const textEvents = events.filter((e) => e.type === `text`)
      expect(textEvents).toHaveLength(2)
      expect(textEvents[0]).toEqual({ type: `text`, text: `Part one` })
      expect(textEvents[1]).toEqual({ type: `text`, text: ` Part two` })
    })

    it(`should yield tool_call_start and tool_call_args events for function calls`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: `get_weather`,
                      args: { location: `San Francisco` },
                    },
                  },
                ],
              },
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toContainEqual({
        type: `tool_call_start`,
        id: `tool_0`,
        name: `get_weather`,
      })
      expect(events).toContainEqual({
        type: `tool_call_args`,
        id: `tool_0`,
        args: JSON.stringify({ location: `San Francisco` }),
      })
    })

    it(`should increment tool call counter for multiple function calls`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: `get_weather`,
                      args: { location: `NYC` },
                    },
                  },
                  {
                    functionCall: {
                      name: `get_time`,
                      args: { timezone: `EST` },
                    },
                  },
                ],
              },
            },
          ],
        },
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: `search`,
                      args: { query: `test` },
                    },
                  },
                ],
              },
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      const startEvents = events.filter((e) => e.type === `tool_call_start`)
      expect(startEvents).toHaveLength(3)
      expect(startEvents[0]).toEqual({
        type: `tool_call_start`,
        id: `tool_0`,
        name: `get_weather`,
      })
      expect(startEvents[1]).toEqual({
        type: `tool_call_start`,
        id: `tool_1`,
        name: `get_time`,
      })
      expect(startEvents[2]).toEqual({
        type: `tool_call_start`,
        id: `tool_2`,
        name: `search`,
      })
    })

    it(`should use empty string for functionCall.name when name is undefined`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: undefined,
                      args: { key: `value` },
                    },
                  },
                ],
              },
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toContainEqual({
        type: `tool_call_start`,
        id: `tool_0`,
        name: ``,
      })
    })

    it(`should use empty object for functionCall.args when args is undefined`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: `no_args_tool`,
                      args: undefined,
                    },
                  },
                ],
              },
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toContainEqual({
        type: `tool_call_args`,
        id: `tool_0`,
        args: `{}`,
      })
    })

    it(`should map STOP finishReason to end_turn`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [{ text: `Done` }],
              },
              finishReason: `STOP`,
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toContainEqual({
        type: `done`,
        stopReason: `end_turn`,
      })
    })

    it(`should map MAX_TOKENS finishReason to max_tokens`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [{ text: `Truncated` }],
              },
              finishReason: `MAX_TOKENS`,
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toContainEqual({
        type: `done`,
        stopReason: `max_tokens`,
      })
    })

    it(`should map unknown finishReason to end_turn`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [{ text: `Safety` }],
              },
              finishReason: `SAFETY`,
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toContainEqual({
        type: `done`,
        stopReason: `end_turn`,
      })
    })

    it(`should skip chunks with no candidates`, async () => {
      const stream = createMockStream([
        {},
        { candidates: null },
        { candidates: [] },
        {
          candidates: [
            {
              content: {
                parts: [{ text: `After empty` }],
              },
              finishReason: `STOP`,
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({ type: `text`, text: `After empty` })
      expect(events[1]).toEqual({ type: `done`, stopReason: `end_turn` })
    })

    it(`should skip chunks where candidates[0] has no content or parts`, async () => {
      const stream = createMockStream([
        { candidates: [{}] },
        { candidates: [{ content: {} }] },
        { candidates: [{ content: { parts: null } }] },
        {
          candidates: [
            {
              content: {
                parts: [{ text: `Valid` }],
              },
              finishReason: `STOP`,
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({ type: `text`, text: `Valid` })
      expect(events[1]).toEqual({ type: `done`, stopReason: `end_turn` })
    })

    it(`should use config.systemPrompt when provided`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const config = { ...baseConfig, systemPrompt: `You are a helpful assistant.` }

      await collectEvents(adapter.stream([userMessage], [], config))

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: `You are a helpful assistant.`,
          }),
        })
      )
    })

    it(`should extract system prompt from messages when config.systemPrompt is not set`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const messages: TAIMessage[] = [
        {
          role: `system`,
          content: [
            { type: `text`, text: `You are a bot.` },
            { type: `text`, text: `Be concise.` },
          ],
        },
        userMessage,
      ]

      await collectEvents(adapter.stream(messages, [], baseConfig))

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: `You are a bot.\nBe concise.`,
          }),
        })
      )
    })

    it(`should filter out system messages from contents`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const messages: TAIMessage[] = [
        {
          role: `system`,
          content: [{ type: `text`, text: `System prompt` }],
        },
        userMessage,
      ]

      await collectEvents(adapter.stream(messages, [], baseConfig))

      const callArgs = mockGenerateContentStream.mock.calls[0][0]
      const contents = callArgs.contents
      expect(contents).toHaveLength(1)
      expect(contents[0].role).toBe(`user`)
    })

    it(`should map assistant role to model role in contents`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const messages: TAIMessage[] = [
        userMessage,
        {
          role: `assistant`,
          content: [{ type: `text`, text: `Hi there` }],
        },
      ]

      await collectEvents(adapter.stream(messages, [], baseConfig))

      const callArgs = mockGenerateContentStream.mock.calls[0][0]
      const contents = callArgs.contents
      expect(contents[0].role).toBe(`user`)
      expect(contents[1].role).toBe(`model`)
    })

    it(`should convert tool definitions to Google function declarations`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const tools: TLLMToolDef[] = [
        {
          name: `get_weather`,
          description: `Get weather for a location`,
          inputSchema: {
            type: `object`,
            properties: {
              location: { type: `string`, description: `The city name` },
            },
            required: [`location`],
          },
        },
      ]

      await collectEvents(adapter.stream([userMessage], tools, baseConfig))

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            tools: [
              {
                functionDeclarations: [
                  {
                    name: `get_weather`,
                    description: `Get weather for a location`,
                    parameters: {
                      type: `object`,
                      properties: {
                        location: { type: `string`, description: `The city name` },
                      },
                      required: [`location`],
                    },
                  },
                ],
              },
            ],
          }),
        })
      )
    })

    it(`should not include tools config when tools array is empty`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))

      await collectEvents(adapter.stream([userMessage], [], baseConfig))

      const callArgs = mockGenerateContentStream.mock.calls[0][0]
      expect(callArgs.config.tools).toBeUndefined()
    })

    it(`should convert tool_use content to functionCall in contents`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const messages: TAIMessage[] = [
        userMessage,
        {
          role: `assistant`,
          content: [
            {
              type: `tool_use`,
              id: `call_1`,
              name: `get_weather`,
              input: { location: `SF` },
            },
          ],
        },
      ]

      await collectEvents(adapter.stream(messages, [], baseConfig))

      const callArgs = mockGenerateContentStream.mock.calls[0][0]
      const assistantContent = callArgs.contents[1]
      expect(assistantContent.parts[0]).toEqual({
        functionCall: { name: `get_weather`, args: { location: `SF` } },
      })
    })

    it(`should convert tool_result content to functionResponse in contents`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))
      const messages: TAIMessage[] = [
        {
          role: `user`,
          content: [
            {
              type: `tool_result`,
              toolUseId: `get_weather`,
              content: `72°F and sunny`,
            },
          ],
        },
      ]

      await collectEvents(adapter.stream(messages, [], baseConfig))

      const callArgs = mockGenerateContentStream.mock.calls[0][0]
      const userContent = callArgs.contents[0]
      expect(userContent.parts[0]).toEqual({
        functionResponse: {
          name: `get_weather`,
          response: { result: `72°F and sunny` },
        },
      })
    })

    it(`should handle mixed text and function call parts in a single chunk`, async () => {
      const stream = createMockStream([
        {
          candidates: [
            {
              content: {
                parts: [
                  { text: `Let me check the weather.` },
                  {
                    functionCall: {
                      name: `get_weather`,
                      args: { location: `Tokyo` },
                    },
                  },
                ],
              },
            },
          ],
        },
      ])
      mockGenerateContentStream.mockResolvedValue(stream)

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events[0]).toEqual({ type: `text`, text: `Let me check the weather.` })
      expect(events[1]).toEqual({
        type: `tool_call_start`,
        id: `tool_0`,
        name: `get_weather`,
      })
      expect(events[2]).toEqual({
        type: `tool_call_args`,
        id: `tool_0`,
        args: JSON.stringify({ location: `Tokyo` }),
      })
    })

    it(`should produce no events from an empty stream`, async () => {
      mockGenerateContentStream.mockResolvedValue(createMockStream([]))

      const events = await collectEvents(adapter.stream([userMessage], [], baseConfig))

      expect(events).toHaveLength(0)
    })
  })
})
