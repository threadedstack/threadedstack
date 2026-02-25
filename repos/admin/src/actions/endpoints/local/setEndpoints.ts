import type { Endpoint } from '@tdsk/domain'
import { setProjectEndpoints } from '@TAF/state/accessors'

export const setEndpoints = (projectId: string, endpoints: Endpoint[]) => {
  const map =
    endpoints?.reduce(
      (acc, endpoint: Endpoint) => {
        acc[endpoint.id] = endpoint
        return acc
      },
      {} as Record<string, Endpoint>
    ) || {}

  setProjectEndpoints(projectId, map)
}
