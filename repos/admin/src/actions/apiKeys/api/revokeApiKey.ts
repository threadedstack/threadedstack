import { apiKeysApi } from '@TAF/services'
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

  return resp
}
