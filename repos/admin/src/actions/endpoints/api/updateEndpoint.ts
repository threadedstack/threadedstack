import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export const updateEndpoint = async (id: string, ep: Partial<Endpoint>) => {
  const resp = await endpointsApi.update(id, ep)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(resp.data)

  return resp
}
