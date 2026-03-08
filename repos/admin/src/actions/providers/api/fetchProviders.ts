import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders } from '@TAF/actions/providers/local/setProviders'

export type TFetchProvidersOpts = {
  orgId: string
}

export const fetchProviders = async (opts: TFetchProvidersOpts) => {
  const { orgId } = opts
  const resp = await providersApi.list(orgId)

  if (resp.error) return { error: resp.error }

  resp.data && setProviders(resp.data)
  return resp
}
