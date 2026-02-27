import { apiKeysApi } from '@TAF/services'
import { upsertApiKey } from '@TAF/actions/apiKeys/local/upsertApiKey'

export type TFetchApiKeyOpts = {
  orgId: string
  id: string
}

export const fetchApiKey = async (opts: TFetchApiKeyOpts) => {
  const { orgId, id } = opts
  const resp = await apiKeysApi.get(orgId, id)
  if (resp.error) return { error: resp.error }
  resp.data && upsertApiKey(resp.data)

  return resp
}
