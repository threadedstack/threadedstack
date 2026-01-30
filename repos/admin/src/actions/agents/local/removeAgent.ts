import { setAgents, getAgents } from '@TAF/state/accessors'

export const removeAgent = (id: string) => {
  const current = getAgents() || {}
  const { [id]: _, ...rest } = current
  setAgents(rest)
}
