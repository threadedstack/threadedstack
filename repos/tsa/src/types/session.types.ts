import type { TAIProviderBrand, TAgentEnvironment } from '@tdsk/domain'

export type TProviderInfo = {
  id: string
  name: string
  model: string
  provider: TAIProviderBrand
}

export enum EConnectionStatus {
  connected = `connected`,
  disconnected = `disconnected`,
  reconnecting = `reconnecting`,
}

export type TConnectionStatus = `${EConnectionStatus}`

export type TSessionInfo = {
  model: string
  tools?: string[]
  maxTokens?: number
  sessionToken: string
  systemPrompt?: string
  provider: TAIProviderBrand
  environment?: TAgentEnvironment
}

export type TCachedSession = {
  agentId: string
  providerId?: string
  session: TSessionInfo
}
