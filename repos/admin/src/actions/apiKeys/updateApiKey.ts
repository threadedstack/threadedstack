import type { ApiKey } from '@tdsk/domain'

import { apiKeysApi } from '@TAF/services'
import { setApiKey } from '@TAF/state/accessors'

export type TUpdateApiKeyResult = {
  apiKey?: ApiKey
  error?: Error
}

export const updateApiKey = async (
  id: string,
  data: Partial<ApiKey>
): Promise<TUpdateApiKeyResult> => {
  const resp = await apiKeysApi.update(id, data)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    setApiKey(resp.data)
  }

  return { apiKey: resp.data }
}
