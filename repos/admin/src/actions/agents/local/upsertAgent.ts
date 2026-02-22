import type { Agent } from '@tdsk/domain'
import { getContextAgents, setContextAgents } from '@TAF/state/accessors'

export const upsertAgent = (contextKey: string, agent: Agent) => {
  const current = getContextAgents(contextKey) || {}
  setContextAgents(contextKey, { ...current, [agent.id]: agent })
}
