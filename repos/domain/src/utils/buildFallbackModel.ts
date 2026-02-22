import type { TLLMAdapterConfig } from '@TDM/types'

/**
 * Construct a pi-ai-compatible Model object for OpenAI-compatible providers
 * not in pi-ai's static registry (Ollama, custom, new OpenRouter models).
 * Returns undefined if required fields are missing.
 */
export const buildFallbackModel = (config: TLLMAdapterConfig) => {
  if (!config.model || !config.provider || !config.baseUrl) return undefined

  return {
    id: config.model,
    name: config.model,
    api: `openai-completions` as const,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: false,
    input: [`text` as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: config.maxTokens || 8192,
    headers: config.headers,
  }
}
