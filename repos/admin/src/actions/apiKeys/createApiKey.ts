import type { TCreateApiKeyResponse } from '@TAF/services/apiKeysApi'

import { ApiKey } from '@tdsk/domain'
import { apiKeysApi } from '@TAF/services'
import { setApiKey } from '@TAF/state/accessors'

export type TCreateApiKeyResult = {
  error?: Error
  data?: TCreateApiKeyResponse
}

export const createApiKey = async (
  data: Partial<ApiKey>
): Promise<TCreateApiKeyResult> => {
  const resp = await apiKeysApi.create(data)

  if (resp.error) return { error: resp.error }
  resp.data && setApiKey(new ApiKey(resp.data).sanitize())

  return resp
}
