import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export const removeEndpoint = (id: string) => {
  const current = getEndpoints() || {}
  const { [id]: removed, ...eps } = current
  setEndpoints(eps)
}
