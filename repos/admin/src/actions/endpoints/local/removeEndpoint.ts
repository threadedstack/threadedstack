import { getProjectEndpoints, setProjectEndpoints } from '@TAF/state/accessors'

export const removeEndpoint = (projectId: string, id: string) => {
  const current = getProjectEndpoints(projectId) || {}
  const { [id]: removed, ...eps } = current
  setProjectEndpoints(projectId, eps)
}
