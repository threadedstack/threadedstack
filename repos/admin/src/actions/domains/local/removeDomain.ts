import { setDomains, getDomains } from '@TAF/state/accessors'

export const removeDomain = (id: string) => {
  const { [id]: removed, ...remaining } = getDomains() || {}
  setDomains(remaining)
}
