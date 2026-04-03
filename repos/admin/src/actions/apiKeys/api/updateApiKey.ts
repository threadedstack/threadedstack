import type { ApiKey } from '@tdsk/domain'

import { apiKeysApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertApiKey } from '@TAF/actions/apiKeys/local/upsertApiKey'

export type TUpdateApiKeyOpts = {
  orgId: string
  id: string
  data: Partial<ApiKey>
}

export const updateApiKey = async (opts: TUpdateApiKeyOpts) => {
  const { orgId, id, data } = opts
  const resp = await apiKeysApi.update(orgId, id, data)
  if (resp.error) return { error: resp.error }

  resp.data && upsertApiKey(resp.data)
  resp.data && query.client.invalidateQueries({ queryKey: apiKeysApi.cache.all() })
  resp.data && query.updateDetailCache(apiKeysApi.cache.detail(id), resp.data)

  return resp
}
