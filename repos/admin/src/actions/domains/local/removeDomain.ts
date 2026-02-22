import { getContextDomains, setContextDomains } from '@TAF/state/accessors'

export const removeDomain = (contextKey: string, id: string) => {
  const { [id]: removed, ...remaining } = getContextDomains(contextKey) || {}
  setContextDomains(contextKey, remaining)
}
