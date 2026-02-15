import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TCreateProviderOpts = {
  orgId: string
  data: Partial<Provider>
}

export type TCreateProviderResult = {
  provider?: Provider
  error?: Error
}

export const createProvider = async (
  opts: TCreateProviderOpts
): Promise<TCreateProviderResult> => {
  const { orgId, data } = opts
  const resp = await providersApi.create(orgId, data)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    const currentProviders = getProviders() || {}
    setProviders({ ...currentProviders, [resp.data.id]: resp.data })
  }

  return { provider: resp.data }
}
