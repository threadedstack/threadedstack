import type { TActivityRecord, TAgentStatus } from '@TAF/types/agentActivity.types'

import {
  setContextAgentTurns,
  setContextAgentStatus,
  setContextAgentMemories,
  setContextAgentMessages,
} from '@TAF/state/accessors'

export const setAgentStatus = (agentId: string, status: TAgentStatus | null) =>
  setContextAgentStatus(agentId, status)

export const setAgentTurns = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentTurns(agentId, rows)

export const setAgentMessages = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentMessages(agentId, rows)

export const setAgentMemories = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentMemories(agentId, rows)
