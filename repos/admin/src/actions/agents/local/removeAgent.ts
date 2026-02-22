import { getContextAgents, setContextAgents } from '@TAF/state/accessors'

export const removeAgent = (contextKey: string, id: string) => {
  const current = getContextAgents(contextKey) || {}
  const { [id]: _, ...rest } = current
  setContextAgents(contextKey, rest)
}
