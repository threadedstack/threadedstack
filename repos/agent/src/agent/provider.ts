import type {
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
  async complete(sys: string, usr: string): Promise<string> {
    const response = await fetch(`${this.url}${this.path ?? ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || JSON.stringify(data)
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
  async complete(system: string, user: string): Promise<string> {
    const response = await fetch(`${this.url}${this.path ?? ''}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.key,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        system: system,
        max_tokens: 4096,
        model: this.model,
        messages: [{ role: 'user', content: user }],
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.content[0].text
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
      path: opts.path ?? '/v1/chat/completions',
      url: opts.url ?? 'https://api.x.ai',
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
