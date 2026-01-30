import { endpointsApi } from '@TAF/services'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export const fetchEndpoint = async (id: string) => {
  const resp = await endpointsApi.get(id)
  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(resp.data)

  return resp
}
