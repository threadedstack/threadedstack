import type { Endpoint } from '@tdsk/domain'

import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export const upsertEndpoints = (endpoints: Endpoint[]) => {
  const endpointsMap =
    endpoints?.reduce(
      (acc, endpoint: Endpoint) => {
        acc[endpoint.id] = endpoint
        return acc
      },
      {} as Record<string, Endpoint>
    ) || {}

  setEndpoints({ ...getEndpoints(), ...endpointsMap })
}
