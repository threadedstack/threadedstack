import type { TLLMProviderBrand } from '@tdsk/domain'

export type TSessionInfo = {
  model: string
  maxTokens?: number
  sessionToken: string
  systemPrompt?: string
  provider: TLLMProviderBrand
}

export type TProviderInfo = {
  id: string
  name: string
  model: string
  provider: TLLMProviderBrand
}

export type TConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'
