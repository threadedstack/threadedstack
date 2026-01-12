import type { ApiKey } from '@tdsk/domain'

import { apiKeysApi } from '@TAF/services'
import { setApiKeys } from '@TAF/state/accessors'

export type TFetchApiKeysResult = {
  apiKeys?: Record<string, ApiKey>
  error?: Error
}

export const fetchApiKeys = async (filters?: {
  orgId?: string
  repoId?: string
}): Promise<TFetchApiKeysResult> => {
  const resp = await apiKeysApi.list(filters)

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
