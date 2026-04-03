import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertProvider } from '@TAF/actions/providers/local/upsertProvider'

export type TUpdateProviderOpts = {
  id: string
  orgId: string
  data: Partial<Provider>
}

export const updateProvider = async (opts: TUpdateProviderOpts) => {
  const { orgId, id, data } = opts
  const resp = await providersApi.update(orgId, id, data)

  if (resp.error) return { error: resp.error }

  resp.data && upsertProvider(resp.data)
  resp.data && query.upsertListCache(providersApi.cache.list(orgId), resp.data)
  resp.data && query.updateDetailCache(providersApi.cache.detail(id), resp.data)

  return resp
}
