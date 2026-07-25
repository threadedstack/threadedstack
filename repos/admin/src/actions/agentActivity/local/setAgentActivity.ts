import type {
  TAgentPlan,
  TActivityRecord,
  TAgentStatus,
} from '@TAF/types/agentActivity.types'

import {
  setContextAgentPlans,
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

export const setAgentPlans = (agentId: string, rows: TAgentPlan[]) =>
  setContextAgentPlans(agentId, rows)
