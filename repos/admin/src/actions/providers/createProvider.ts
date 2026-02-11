import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TCreateProviderOpts = {
  orgId: string
  data: Partial<Provider>
  projectId?: string
}

export type TCreateProviderResult = {
  provider?: Provider
  error?: Error
}

export const createProvider = async (
  opts: TCreateProviderOpts
): Promise<TCreateProviderResult> => {
  const { orgId, data, projectId } = opts
  const resp = await providersApi.create(orgId, data, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update providers state with the new provider
    const currentProviders = getProviders() || {}
    setProviders({ ...currentProviders, [resp.data.id]: resp.data })
  }

  return { provider: resp.data }
}
