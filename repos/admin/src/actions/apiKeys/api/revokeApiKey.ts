import { apiKeysApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeApiKey } from '@TAF/actions/apiKeys/local/removeApiKey'

export type TRevokeApiKeyOpts = {
  orgId: string
  id: string
}

export const revokeApiKey = async (opts: TRevokeApiKeyOpts) => {
  const { orgId, id } = opts
  const resp = await apiKeysApi.revoke(orgId, id)
  if (resp.error) return { error: resp.error }
  removeApiKey(id)
  query.client.invalidateQueries({ queryKey: apiKeysApi.cache.all() })
  query.client.removeQueries({ queryKey: apiKeysApi.cache.detail(id) })

  return resp
}
