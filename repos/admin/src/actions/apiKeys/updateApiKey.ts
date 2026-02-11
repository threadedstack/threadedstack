import type { ApiKey } from '@tdsk/domain'

import { apiKeysApi } from '@TAF/services'
import { setApiKey } from '@TAF/state/accessors'

export type TUpdateApiKeyOpts = {
  orgId: string
  id: string
  data: Partial<ApiKey>
}

export type TUpdateApiKeyResult = {
  apiKey?: ApiKey
  error?: Error
}

export const updateApiKey = async (
  opts: TUpdateApiKeyOpts
): Promise<TUpdateApiKeyResult> => {
  const { orgId, id, data } = opts
  const resp = await apiKeysApi.update(orgId, id, data)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    setApiKey(resp.data)
  }

  return { apiKey: resp.data }
}
