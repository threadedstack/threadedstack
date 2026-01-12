import type { ApiKey } from '@tdsk/domain'

import { apiKeysApi } from '@TAF/services'
import { setApiKey, setActiveApiKeyId } from '@TAF/state/accessors'

export type TFetchApiKeyResult = {
  apiKey?: ApiKey
  error?: Error
}

export const fetchApiKey = async (id: string): Promise<TFetchApiKeyResult> => {
  const resp = await apiKeysApi.get(id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    setApiKey(resp.data)
    setActiveApiKeyId(resp.data.id)
  }

  return { apiKey: resp.data }
}
