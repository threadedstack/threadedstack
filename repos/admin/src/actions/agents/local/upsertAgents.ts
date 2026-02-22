import type { Agent } from '@tdsk/domain'
import { getContextAgents, setContextAgents } from '@TAF/state/accessors'

export const upsertAgents = (contextKey: string, agents: Agent[]) => {
  const current = getContextAgents(contextKey) || {}
  const agentsMap = agents.reduce(
    (acc, agent) => {
      acc[agent.id] = agent
      return acc
    },
    {} as Record<string, Agent>
  )

  setContextAgents(contextKey, { ...current, ...agentsMap })
}
