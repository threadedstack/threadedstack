import type { Agent } from '@tdsk/domain'

import { setAgents, getAgents } from '@TAF/state/accessors'

export const upsertAgent = (agent: Agent) => {
  const current = getAgents() || {}
  setAgents({ ...current, [agent.id]: agent })
}
