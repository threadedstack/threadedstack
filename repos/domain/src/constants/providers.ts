import type { TProviderTemplate } from '../types/quickstart.types'

/**
 * TODO: Figure out how to Replace this with a dynamic look up of AI models
 * Use one of:
 *  - https://openrouter.ai/api/v1/models
 *  - https://ai-gateway.vercel.sh/v1/models
 */
export const ProviderTemplates: Record<string, TProviderTemplate> = {
  anthropic: {
    id: `anthropic`,
    name: `Anthropic`,
    baseUrl: `https://api.anthropic.com`,
    defaultModel: `claude-sonnet-4-20250514`,
    defaultSecretName: `ANTHROPIC_API_KEY`,
    apiKeyPlaceholder: `sk-ant-api03-...`,
    apiKeyPattern: `^sk-ant-`,
    models: [
      {
        id: `claude-sonnet-4-20250514`,
        name: `Claude Sonnet 4`,
        maxTokens: 64000,
        description: `Best balance of speed and intelligence`,
      },
      {
        id: `claude-opus-4-20250514`,
        name: `Claude Opus 4`,
        maxTokens: 32000,
        description: `Most capable for complex tasks`,
      },
      {
        id: `claude-haiku-3-5-20241022`,
        name: `Claude Haiku 3.5`,
        maxTokens: 8192,
        description: `Fastest and most cost-effective`,
      },
    ],
  },
  openai: {
    id: `openai`,
    name: `OpenAI`,
    baseUrl: `https://api.openai.com/v1`,
    defaultModel: `gpt-4o`,
    defaultSecretName: `OPENAI_API_KEY`,
    apiKeyPlaceholder: `sk-...`,
    apiKeyPattern: `^sk-`,
    models: [
      {
        id: `gpt-4o`,
        name: `GPT-4o`,
        maxTokens: 16384,
        description: `Flagship model for complex tasks`,
      },
      {
        id: `gpt-4o-mini`,
        name: `GPT-4o Mini`,
        maxTokens: 16384,
        description: `Small and affordable for fast tasks`,
      },
      {
        id: `o3-mini`,
        name: `o3 Mini`,
        maxTokens: 100000,
        description: `Reasoning model for complex problems`,
      },
    ],
  },
  google: {
    id: `google`,
    name: `Google AI`,
    baseUrl: `https://generativelanguage.googleapis.com/v1`,
    defaultModel: `gemini-2.0-flash`,
    defaultSecretName: `GOOGLE_AI_API_KEY`,
    apiKeyPlaceholder: `AIza...`,
    apiKeyPattern: `^AIza`,
    models: [
      {
        id: `gemini-2.0-flash`,
        name: `Gemini 2.0 Flash`,
        maxTokens: 8192,
        description: `Fast and versatile`,
      },
      {
        id: `gemini-2.0-pro`,
        name: `Gemini 2.0 Pro`,
        maxTokens: 8192,
        description: `Best for complex reasoning`,
      },
    ],
  },
  zai: {
    id: `zai`,
    name: `Z.AI`,
    baseUrl: `https://api.z.ai/api/paas/v4`,
    defaultModel: `glm-5`,
    defaultSecretName: `ZAI_API_KEY`,
    apiKeyPlaceholder: `Enter your Z.AI API key...`,
    apiKeyPattern: ``,
    models: [
      {
        id: `glm-5`,
        name: `GLM-5`,
        maxTokens: 131072,
        description: `Most capable model`,
      },
      {
        id: `glm-4.7`,
        name: `GLM-4.7`,
        maxTokens: 131072,
        description: `High performance`,
      },
      {
        id: `glm-4.6`,
        name: `GLM-4.6`,
        maxTokens: 131072,
        description: `Supports tool streaming`,
      },
      {
        id: `glm-4.5`,
        name: `GLM-4.5`,
        maxTokens: 131072,
        description: `Efficient with thinking mode`,
      },
    ],
  },
  custom: {
    id: `custom`,
    name: `Custom Provider`,
    baseUrl: ``,
    defaultModel: ``,
    defaultSecretName: `PROVIDER_API_KEY`,
    apiKeyPlaceholder: `Enter your API key...`,
    models: [],
  },
}
