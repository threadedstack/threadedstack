import { apiKeysApi } from '@TAF/services'
import { removeApiKey } from '@TAF/state/accessors'

export type TRevokeApiKeyOpts = {
  orgId: string
  id: string
}

export type TRevokeApiKeyResult = {
  success?: boolean
  error?: Error
}

export const revokeApiKey = async (
  opts: TRevokeApiKeyOpts
): Promise<TRevokeApiKeyResult> => {
  const { orgId, id } = opts
  const resp = await apiKeysApi.revoke(orgId, id)
  if (resp.error) return { error: resp.error }

  resp.data?.success && removeApiKey(id)

  return { success: resp.data?.success }
}
