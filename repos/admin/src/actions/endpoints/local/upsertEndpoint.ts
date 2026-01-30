import type { Endpoint } from '@tdsk/domain'

import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export const upsertEndpoint = (endpoint: Endpoint) => {
  setEndpoints({ ...getEndpoints(), [endpoint.id]: endpoint })
}
