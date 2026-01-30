import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export const removeEndpoint = (id: string) => {
  const current = getEndpoints() || {}
  const { [id]: removed, ...remainingEndpoints } = current
  setEndpoints(remainingEndpoints)
}
