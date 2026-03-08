import { providersApi } from '@TAF/services'
import { upsertProvider } from '@TAF/actions/providers/local/upsertProvider'

export type TFetchProviderOpts = {
  orgId: string
  id: string
}

export const fetchProvider = async (opts: TFetchProviderOpts) => {
  const { orgId, id } = opts
  const resp = await providersApi.get(orgId, id)

  if (resp.error) return { error: resp.error }

  resp.data && upsertProvider(resp.data)

  return resp
}
