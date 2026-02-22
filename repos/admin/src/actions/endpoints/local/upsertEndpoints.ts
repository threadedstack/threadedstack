import type { Endpoint } from '@tdsk/domain'
import { getProjectEndpoints, setProjectEndpoints } from '@TAF/state/accessors'

export const upsertEndpoints = (projectId: string, endpoints: Endpoint[]) => {
  const current = getProjectEndpoints(projectId) || {}
  const endpointsMap =
    endpoints?.reduce(
      (acc, endpoint: Endpoint) => {
        acc[endpoint.id] = endpoint
        return acc
      },
      {} as Record<string, Endpoint>
    ) || {}

  setProjectEndpoints(projectId, { ...current, ...endpointsMap })
}
