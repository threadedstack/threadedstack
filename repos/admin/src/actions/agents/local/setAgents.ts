import type { Agent } from '@tdsk/domain'
import { setContextAgents } from '@TAF/state/accessors'

export const setAgents = (contextKey: string, agents: Agent[]) => {
  const map = agents.reduce(
    (acc, agent) => {
      acc[agent.id] = agent
      return acc
    },
    {} as Record<string, Agent>
  )

  setContextAgents(contextKey, map)
}
