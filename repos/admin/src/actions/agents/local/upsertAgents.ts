import type { Agent } from '@tdsk/domain'
import { getContextAgents, setContextAgents } from '@TAF/state/accessors'

export const upsertAgents = (contextKey: string, agents: Agent[]) => {
  const current = getContextAgents(contextKey) || {}
  const agentsMap = Object.fromEntries(
    agents.map((agent) => [agent.id, agent])
  ) as Record<string, Agent>
  setContextAgents(contextKey, { ...current, ...agentsMap })
}
