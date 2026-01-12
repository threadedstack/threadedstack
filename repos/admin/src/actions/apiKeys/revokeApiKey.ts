import { apiKeysApi } from '@TAF/services'
import { removeApiKey } from '@TAF/state/accessors'

export type TRevokeApiKeyResult = {
  success?: boolean
  error?: Error
}

export const revokeApiKey = async (id: string): Promise<TRevokeApiKeyResult> => {
  const resp = await apiKeysApi.revoke(id)
  if (resp.error) return { error: resp.error }

  resp.data?.success && removeApiKey(id)

  return { success: resp.data?.success }
}
