import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TFetchProviderOpts = {
  orgId: string
  id: string
}

export type TFetchProviderResult = {
  provider?: Provider
  error?: Error
}

export const fetchProvider = async (
  opts: TFetchProviderOpts
): Promise<TFetchProviderResult> => {
  const { orgId, id } = opts
  const resp = await providersApi.get(orgId, id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    const currentProviders = getProviders() || {}
    setProviders({ ...currentProviders, [resp.data.id]: resp.data })
  }

  return { provider: resp.data }
}
