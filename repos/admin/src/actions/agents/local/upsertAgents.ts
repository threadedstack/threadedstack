import type { Agent } from '@tdsk/domain'
import { setAgents, getAgents } from '@TAF/state/accessors'

export const upsertAgents = (agents: Agent[]) => {
  const current = getAgents() || {}
  const agentsMap = agents.reduce(
    (acc, agent) => {
      acc[agent.id] = agent
      return acc
    },
    {} as Record<string, Agent>
  )

  setAgents({ ...current, ...agentsMap })
}
