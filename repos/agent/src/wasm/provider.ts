import type {
  TMessage,
  TToolCall,
  TLLMResponse,
  TLLMProvider,
  TLLMBaseOpts,
  ILLMProvider,
  TLLMProviderOpts,
} from '@TAG/types'

/**
 * Base LLM Provider class implementing common functionality
 */
class BaseProvider implements ILLMProvider {
  key: string
  url: string
  path?: string
  model: string
  type: TLLMProvider

  constructor(opts: TLLMBaseOpts) {
    this.key = opts.key
    this.url = opts.url
    this.path = opts.path
    this.model = opts.model
    this.type = opts.type
  }

  /**
   * Default implementation for OpenAI-compatible APIs
   */
  async complete(
    system: string,
    messages: TMessage[],
    tools: any[]
  ): Promise<TLLMResponse> {
    const formattedMessages = [
      { role: 'system', content: system },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
      })),
    ]

    const response = await fetch(`${this.url}${this.path ?? ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        tools,
        model: this.model,
        tool_choice: 'auto',
        messages: formattedMessages,
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]

    if (!choice) {
      throw new Error('No response from LLM')
    }

    return {
      finish_reason: choice.finish_reason,
      content: choice.message?.content || '',
      tool_calls: choice.message?.tool_calls,
    }
  }
}

/**
 * OpenAI Provider (also compatible with OpenAI-like APIs)
 */
class OpenAI extends BaseProvider {
  constructor(opts: TLLMProviderOpts) {
    super({
      ...opts,
      type: 'openai',
      model: opts.model ?? 'gpt-4o',
      path: opts.path ?? '/v1/chat/completions',
      url: opts.url ?? 'https://api.openai.com',
    })
  }
}

/**
 * Anthropic Claude Provider
 */
class Anthropic extends BaseProvider {
  constructor(opts: TLLMProviderOpts) {
    super({
      ...opts,
      type: 'anthropic',
      path: opts.path ?? '/v1/messages',
      url: opts.url ?? 'https://api.anthropic.com',
      model: opts.model ?? 'claude-3-5-sonnet-20240620',
    })
  }

  /**
   * Anthropic uses a different API format
   */
  async complete(
    system: string,
    messages: TMessage[],
    tools: any[]
  ): Promise<TLLMResponse> {
    const formattedMessages = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.tool_call_id,
              content: m.content,
            },
          ],
        }
      }
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }
    })

    const response = await fetch(`${this.url}${this.path ?? ''}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        system,
        max_tokens: 4096,
        model: this.model,
        messages: formattedMessages,
        tools,
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Convert Anthropic tool_use to OpenAI format
    const content = data.content.find((c: any) => c.type === 'text')?.text || ''
    const toolUses = data.content.filter((c: any) => c.type === 'tool_use')

    const tool_calls = toolUses.map((use: any) => ({
      id: use.id,
      type: 'function' as const,
      function: {
        name: use.name,
        arguments: JSON.stringify(use.input),
      },
    }))

    return {
      content,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      finish_reason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    }
  }
}

/**
 * Grok Provider (X.AI) - Uses OpenAI-compatible API
 */
class Grok extends BaseProvider {
  constructor(opts: TLLMProviderOpts) {
    super({
      ...opts,
      type: 'grok',
      model: opts.model ?? 'grok-beta',
      url: opts.url ?? 'https://api.x.ai',
      path: opts.path ?? '/v1/chat/completions',
    })
  }
}

/**
 * Factory function to create appropriate provider instance
 */
export const getProvider = (opts: TLLMBaseOpts): ILLMProvider => {
  switch (opts.type) {
    case 'openai':
      return new OpenAI(opts)

    case 'grok':
      return new Grok(opts)

    case 'anthropic':
      return new Anthropic(opts)

    case 'gemini':
      // TODO: Implement Gemini provider
      throw new Error('Gemini provider not yet implemented')

    case 'zai':
      // TODO: Implement custom ZAI provider
      throw new Error('ZAI provider not yet implemented')

    default:
      throw new Error(`Unknown LLM Provider: ${opts.type}`)
  }
}
