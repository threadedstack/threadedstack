import type { TAgentEndpointConfig } from '@tdsk/domain'

export type TAgentExecOpts = {
  agentId: string
  prompt: string
  userId: string
  threadId?: string
  projectId?: string
  providerId?: string
  overrides?: TAgentEndpointConfig['overrides']
}
