import type { TContextFile } from '@TRL/types'
import type { TStreamEvent } from '@tdsk/domain'

export type TAgentInfo = {
  id: string
  name: string
  description?: string
}

export type TRunResult = {
  threadId: string
}

export type TExecRunOpts = {
  orgId: string
  agentId: string
  prompt: string
  userId: string
  threadId?: string
  maxSteps?: number
  providerId?: string
  contextFiles?: TContextFile[]
  onEvent: (event: TStreamEvent) => void
}
