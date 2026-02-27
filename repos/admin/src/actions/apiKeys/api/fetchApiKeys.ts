import { apiKeysApi } from '@TAF/services'
import { setApiKeys } from '@TAF/actions/apiKeys/local/setApiKeys'

export type TFetchApiKeysOpts = {
  orgId: string
  userId?: string
  store?: boolean
}

export const fetchApiKeys = async (opts: TFetchApiKeysOpts) => {
  const { orgId, userId, store = true } = opts
  const resp = await apiKeysApi.list(orgId, userId ? { userId } : undefined)

  if (resp.error) return { error: resp.error }

  store && setApiKeys(resp.data)

  return resp
}
