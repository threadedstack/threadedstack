import type { TActivityRecord, TAgentStatus } from '@TAF/types/agentActivity.types'
import type { Record as RecordModel } from '@tdsk/domain'

import {
  setContextAgentTurns,
  setContextAgentStatus,
  setContextAgentMemories,
  setContextAgentMessages,
  setContextCollectionRecords,
} from '@TAF/state/accessors'

export const setAgentStatus = (agentId: string, status: TAgentStatus | null) =>
  setContextAgentStatus(agentId, status)

export const setAgentTurns = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentTurns(agentId, rows)

export const setAgentMessages = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentMessages(agentId, rows)

export const setAgentMemories = (agentId: string, rows: TActivityRecord[]) =>
  setContextAgentMemories(agentId, rows)

export const setCollectionRecords = (
  projectId: string,
  collectionName: string,
  rows: RecordModel[]
) => setContextCollectionRecords(projectId, collectionName, rows)
