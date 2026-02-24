import type { ApiKey } from '@tdsk/domain'

import { apiKeysApi } from '@TAF/services'
import { setApiKeys } from '@TAF/state/accessors'

export type TFetchApiKeysOpts = {
  orgId: string
  userId?: string
}

export type TFetchApiKeysResult = {
  apiKeys?: Record<string, ApiKey>
  error?: Error
}

export const fetchApiKeys = async (
  opts: TFetchApiKeysOpts
): Promise<TFetchApiKeysResult> => {
  const { orgId, userId } = opts
  const resp = await apiKeysApi.list(orgId, userId ? { userId } : undefined)

  if (resp.error) {
    return { error: resp.error }
  }

  const apiKeysMap =
    resp.data?.reduce((acc: Record<string, ApiKey>, apiKey: ApiKey) => {
      acc[apiKey.id] = apiKey
      return acc
    }, {}) || {}

  setApiKeys(apiKeysMap)
  return { apiKeys: apiKeysMap }
}
