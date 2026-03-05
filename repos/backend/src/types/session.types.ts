import type { Function, TLLMAdapterConfig, TAgentEnvironment } from '@tdsk/domain'

export type TSessionPayload = {
  orgId: string
  userId: string
  agentId: string
  projectId?: string
}

export type TSession = TSessionPayload & {
  tools?: string[]
  customFunctions?: Function[]
  llmConfig: TLLMAdapterConfig
  envVars?: Record<string, string>
  environment?: TAgentEnvironment
}
