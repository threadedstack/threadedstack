import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertProvider } from '@TAF/actions/providers/local/upsertProvider'

export type TCreateProviderOpts = {
  orgId: string
  data: Partial<Provider>
}

export const createProvider = async (opts: TCreateProviderOpts) => {
  const { orgId, data } = opts
  const resp = await providersApi.create(orgId, data)

  if (resp.error) return { error: resp.error }

  resp.data && upsertProvider(resp.data)
  resp.data && query.upsertListCache(providersApi.cache.list(orgId), resp.data)

  return resp
}
