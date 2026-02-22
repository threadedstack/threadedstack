import type { Endpoint } from '@tdsk/domain'
import { getProjectEndpoints, setProjectEndpoints } from '@TAF/state/accessors'

export const upsertEndpoint = (projectId: string, endpoint: Endpoint) => {
  const current = getProjectEndpoints(projectId) || {}
  setProjectEndpoints(projectId, { ...current, [endpoint.id]: endpoint })
}
