import type { TLLMProviderBrand } from '@tdsk/domain'

export type TSessionInfo = {
  model: string
  maxTokens?: number
  sessionToken: string
  systemPrompt?: string
  provider: TLLMProviderBrand
}
