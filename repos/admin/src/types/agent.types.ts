import type { TAgentEnvironment } from '@tdsk/domain'

export enum EAgentThreadTab {
  assets = `assets`,
  threads = `threads`,
  messages = `messages`,
}

export type TAgentThreadTab = `${EAgentThreadTab}`

export enum EAgentDetailTab {
  agent = `agent`,
  threads = `threads`,
  skills = `skills`,
  schedules = `schedules`,
}

export type TAgentDetailTab = `${EAgentDetailTab}`

export type TAgentSessionData = {
  model: string
  provider: string
  tools?: string[]
  sessionToken: string
  environment?: TAgentEnvironment
}

/** Reusable AI provider option shape (id, display name, LLM brand) */
export type TAiProviderOption = {
  id: string
  name: string
  brand: string
}

/** API payload shape for creating/updating agents */
export type TAgentPayload = {
  name?: string
  model?: string
  tools?: string[]
  active?: boolean
  maxTokens?: number
  secretIds?: string[]
  description?: string
  systemPrompt?: string
  projectIds?: string[]
  providerIds?: string[]
  functionIds?: string[]
  envVars?: Record<string, string>
  environment?: { streaming?: boolean; temperature?: number }
  providers?: Array<{ id: string; priority: number; model?: string | null }>
}
