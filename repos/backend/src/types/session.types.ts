import type { TLLMAdapterConfig, TAgentEnvironment } from '@tdsk/domain'

export type TSession = {
  orgId: string
  userId: string
  agentId: string
  tools?: string[]
  customFunctions?: any[]
  llmConfig: TLLMAdapterConfig
  envVars?: Record<string, string>
  environment?: TAgentEnvironment
}
