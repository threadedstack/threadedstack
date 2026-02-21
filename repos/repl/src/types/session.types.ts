import type { TLLMProviderBrand } from '@tdsk/domain'

export type TProviderInfo = {
  id: string
  name: string
  model: string
  provider: TLLMProviderBrand
}

export enum EConnectionStatus {
  connected = `connected`,
  disconnected = `disconnected`,
  reconnecting = `reconnecting`,
}

export type TConnectionStatus = `${EConnectionStatus}`

export type TSessionInfo = {
  model: string
  maxTokens?: number
  sessionToken: string
  systemPrompt?: string
  provider: TLLMProviderBrand
}

export type TCachedSession = {
  agentId: string
  providerId?: string
  session: TSessionInfo
}
