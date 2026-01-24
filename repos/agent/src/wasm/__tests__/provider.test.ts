import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getProvider } from '@TAG/wasm/provider'
import type { TLLMBaseOpts } from '@TAG/types'

// Mock fetch globally
global.fetch = vi.fn()

describe('wasm/provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getProvider()', () => {
    it('should create OpenAI provider', () => {
      const opts: TLLMBaseOpts = {
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      }

      const provider = getProvider(opts)
      expect(provider.type).toBe('openai')
      expect(provider.model).toBe('gpt-4o')
      expect(provider.url).toBe('https://api.openai.com')
      expect(provider.path).toBe('/v1/chat/completions')
    })

    it('should create Anthropic provider', () => {
      const opts: TLLMBaseOpts = {
        type: 'anthropic',
        key: 'test-key',
        url: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20240620',
      }

      const provider = getProvider(opts)
      expect(provider.type).toBe('anthropic')
      expect(provider.model).toBe('claude-3-5-sonnet-20240620')
      expect(provider.url).toBe('https://api.anthropic.com')
      expect(provider.path).toBe('/v1/messages')
    })

    it('should create Grok provider', () => {
      const opts: TLLMBaseOpts = {
        type: 'grok',
        key: 'test-key',
        url: 'https://api.x.ai',
        model: 'grok-beta',
      }

      const provider = getProvider(opts)
      expect(provider.type).toBe('grok')
      expect(provider.model).toBe('grok-beta')
      expect(provider.url).toBe('https://api.x.ai')
      expect(provider.path).toBe('/v1/chat/completions')
    })

    it('should throw error for unimplemented Gemini provider', () => {
      const opts: TLLMBaseOpts = {
        type: 'gemini',
        key: 'test-key',
        url: 'https://api.google.com',
        model: 'gemini-pro',
      }

      expect(() => getProvider(opts)).toThrow('Gemini provider not yet implemented')
    })

    it('should throw error for unimplemented ZAI provider', () => {
      const opts: TLLMBaseOpts = {
        type: 'zai',
        key: 'test-key',
        url: 'https://api.zai.com',
        model: 'zai-model',
      }

      expect(() => getProvider(opts)).toThrow('ZAI provider not yet implemented')
    })

    it('should throw error for unknown provider', () => {
      const opts: TLLMBaseOpts = {
        type: 'unknown' as any,
        key: 'test-key',
        url: 'https://api.unknown.com',
        model: 'unknown-model',
      }

      expect(() => getProvider(opts)).toThrow('Unknown LLM Provider: unknown')
    })
  })

  describe('OpenAI Provider', () => {
    it('should use default model and path', () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: undefined as any,
      })

      expect(provider.model).toBe('gpt-4o')
      expect(provider.path).toBe('/v1/chat/completions')
    })

    it('should allow custom model and path', () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-3.5-turbo',
        path: '/custom/path',
      })

      expect(provider.model).toBe('gpt-3.5-turbo')
      expect(provider.path).toBe('/custom/path')
    })

    it('should format messages correctly', async () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: 'Test response',
                role: 'assistant',
              },
            },
          ],
        }),
      } as any)

      await provider.complete('System prompt', [{ role: 'user', content: 'Hello' }], [])

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          },
          body: JSON.stringify({
            tools: [],
            model: 'gpt-4o',
            tool_choice: 'auto',
            messages: [
              { role: 'system', content: 'System prompt' },
              { role: 'user', content: 'Hello' },
            ],
          }),
        })
      )
    })

    it('should return response with content', async () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: 'Test response',
                role: 'assistant',
              },
            },
          ],
        }),
      } as any)

      const response = await provider.complete(
        'System',
        [{ role: 'user', content: 'Hi' }],
        []
      )

      expect(response).toEqual({
        finish_reason: 'stop',
        content: 'Test response',
        tool_calls: undefined,
      })
    })

    it('should return response with tool calls', async () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      })

      const toolCalls = [
        {
          id: 'call_123',
          type: 'function' as const,
          function: {
            name: 'readFile',
            arguments: '{"path":"test.txt"}',
          },
        },
      ]

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                content: '',
                tool_calls: toolCalls,
              },
            },
          ],
        }),
      } as any)

      const response = await provider.complete(
        'System',
        [{ role: 'user', content: 'Hi' }],
        []
      )

      expect(response).toEqual({
        finish_reason: 'tool_calls',
        content: '',
        tool_calls: toolCalls,
      })
    })

    it('should handle API errors', async () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as any)

      await expect(
        provider.complete('System', [{ role: 'user', content: 'Hi' }], [])
      ).rejects.toThrow('LLM API Error: 401 Unauthorized')
    })

    it('should throw error when no choices returned', async () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      } as any)

      await expect(
        provider.complete('System', [{ role: 'user', content: 'Hi' }], [])
      ).rejects.toThrow('No response from LLM')
    })

    it('should include tool_call_id when present', async () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: 'stop',
              message: { content: 'Done', role: 'assistant' },
            },
          ],
        }),
      } as any)

      await provider.complete(
        'System',
        [
          { role: 'user', content: 'Hello' },
          {
            role: 'tool',
            content: 'Tool result',
            tool_call_id: 'call_123',
          },
        ],
        []
      )

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.messages[2]).toEqual({
        role: 'tool',
        content: 'Tool result',
        tool_call_id: 'call_123',
      })
    })
  })

  describe('Anthropic Provider', () => {
    it('should use default model and path', () => {
      const provider = getProvider({
        type: 'anthropic',
        key: 'test-key',
        url: 'https://api.anthropic.com',
        model: undefined as any,
      })

      expect(provider.model).toBe('claude-3-5-sonnet-20240620')
      expect(provider.path).toBe('/v1/messages')
    })

    it('should format messages correctly', async () => {
      const provider = getProvider({
        type: 'anthropic',
        key: 'test-key',
        url: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20240620',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Test response' }],
          stop_reason: 'stop',
        }),
      } as any)

      await provider.complete('System prompt', [{ role: 'user', content: 'Hello' }], [])

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'x-api-key': 'test-key',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            system: 'System prompt',
            max_tokens: 4096,
            model: 'claude-3-5-sonnet-20240620',
            messages: [{ role: 'user', content: 'Hello' }],
            tools: [],
          }),
        })
      )
    })

    it('should convert tool results to correct format', async () => {
      const provider = getProvider({
        type: 'anthropic',
        key: 'test-key',
        url: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20240620',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Done' }],
          stop_reason: 'stop',
        }),
      } as any)

      await provider.complete(
        'System',
        [
          { role: 'user', content: 'Hello' },
          {
            role: 'tool',
            content: 'Tool result',
            tool_call_id: 'call_123',
          },
        ],
        []
      )

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.messages[1]).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call_123',
            content: 'Tool result',
          },
        ],
      })
    })

    it('should convert tool_use to OpenAI format', async () => {
      const provider = getProvider({
        type: 'anthropic',
        key: 'test-key',
        url: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20240620',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            { type: 'text', text: 'Let me read the file' },
            {
              type: 'tool_use',
              id: 'call_456',
              name: 'readFile',
              input: { path: 'test.txt' },
            },
          ],
          stop_reason: 'tool_use',
        }),
      } as any)

      const response = await provider.complete(
        'System',
        [{ role: 'user', content: 'Hi' }],
        []
      )

      expect(response).toEqual({
        content: 'Let me read the file',
        finish_reason: 'tool_calls',
        tool_calls: [
          {
            id: 'call_456',
            type: 'function',
            function: {
              name: 'readFile',
              arguments: '{"path":"test.txt"}',
            },
          },
        ],
      })
    })

    it('should handle multiple tool uses', async () => {
      const provider = getProvider({
        type: 'anthropic',
        key: 'test-key',
        url: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20240620',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'readFile',
              input: { path: 'a.txt' },
            },
            {
              type: 'tool_use',
              id: 'call_2',
              name: 'writeFile',
              input: { path: 'b.txt', content: 'test' },
            },
          ],
          stop_reason: 'tool_use',
        }),
      } as any)

      const response = await provider.complete(
        'System',
        [{ role: 'user', content: 'Hi' }],
        []
      )

      expect(response.tool_calls).toHaveLength(2)
      expect(response.tool_calls?.[0].function.name).toBe('readFile')
      expect(response.tool_calls?.[1].function.name).toBe('writeFile')
    })

    it('should handle API errors', async () => {
      const provider = getProvider({
        type: 'anthropic',
        key: 'test-key',
        url: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20240620',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Rate Limit',
      } as any)

      await expect(
        provider.complete('System', [{ role: 'user', content: 'Hi' }], [])
      ).rejects.toThrow('Anthropic API Error: 429 Rate Limit')
    })
  })

  describe('Grok Provider', () => {
    it('should use default model and path', () => {
      const provider = getProvider({
        type: 'grok',
        key: 'test-key',
        url: 'https://api.x.ai',
        model: undefined as any,
      })

      expect(provider.model).toBe('grok-beta')
      expect(provider.url).toBe('https://api.x.ai')
      expect(provider.path).toBe('/v1/chat/completions')
    })

    it('should use OpenAI-compatible API', async () => {
      const provider = getProvider({
        type: 'grok',
        key: 'test-key',
        url: 'https://api.x.ai',
        model: 'grok-beta',
      })

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: 'Grok response',
                role: 'assistant',
              },
            },
          ],
        }),
      } as any)

      const response = await provider.complete(
        'System',
        [{ role: 'user', content: 'Hi' }],
        []
      )

      expect(response.content).toBe('Grok response')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          },
        })
      )
    })
  })

  describe('Provider Constructor Options', () => {
    it('should store all constructor options', () => {
      const provider = getProvider({
        type: 'openai',
        key: 'my-key',
        url: 'https://custom.api.com',
        path: '/custom/path',
        model: 'custom-model',
      })

      expect(provider.key).toBe('my-key')
      expect(provider.url).toBe('https://custom.api.com')
      expect(provider.path).toBe('/custom/path')
      expect(provider.model).toBe('custom-model')
      expect(provider.type).toBe('openai')
    })

    it('should allow undefined path', () => {
      const provider = getProvider({
        type: 'openai',
        key: 'test-key',
        url: 'https://api.openai.com',
        model: 'gpt-4o',
      })

      // Should use default path
      expect(provider.path).toBe('/v1/chat/completions')
    })
  })
})
