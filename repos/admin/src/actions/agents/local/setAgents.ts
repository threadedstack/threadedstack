import type { Agent } from '@tdsk/domain'
import { setContextAgents } from '@TAF/state/accessors'

export const setAgents = (contextKey: string, agents: Agent[]) => {
  const map = Object.fromEntries(agents.map((agent) => [agent.id, agent])) as Record<
    string,
    Agent
  >
  setContextAgents(contextKey, map)
}
