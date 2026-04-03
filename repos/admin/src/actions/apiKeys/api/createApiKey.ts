import type { ApiKey } from '@tdsk/domain'
import { apiKeysApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertApiKey } from '@TAF/actions/apiKeys/local/upsertApiKey'

export type TCreateApiKeyOpts = {
  orgId: string
  data: Partial<ApiKey>
}

export const createApiKey = async (opts: TCreateApiKeyOpts) => {
  const { orgId, data } = opts
  const resp = await apiKeysApi.create(orgId, data)

  if (resp.error) return { error: resp.error }
  resp.data && upsertApiKey(resp.data.sanitize())
  resp.data && query.client.invalidateQueries({ queryKey: apiKeysApi.cache.all() })

  return resp
}
