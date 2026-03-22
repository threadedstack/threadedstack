import type { TAgentRuntimeConfig } from './agent.types'

export type TSessionPayload = {
  orgId: string
  userId: string
  agentId: string
  projectId?: string
}

export type TSession = TSessionPayload & TAgentRuntimeConfig
