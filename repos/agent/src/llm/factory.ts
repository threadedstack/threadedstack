import type { ILLMAdapter, TLLMProviderType } from '@tdsk/domain'

import { AnthropicAdapter } from './anthropic'
import { OpenAIAdapter } from './openai'
import { GoogleAdapter } from './google'

const adapters = new Map<TLLMProviderType, () => ILLMAdapter>([
  [`anthropic`, () => new AnthropicAdapter()],
  [`openai`, () => new OpenAIAdapter()],
  [`google`, () => new GoogleAdapter()],
])

/**
 * Create an LLM adapter for the specified provider
 * @throws Error if the provider is not supported
 */
export const createLLMAdapter = (provider: TLLMProviderType): ILLMAdapter => {
  const factory = adapters.get(provider)
  if (!factory) {
    throw new Error(`Unknown LLM provider: ${provider}`)
  }
  return factory()
}
