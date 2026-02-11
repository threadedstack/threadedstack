import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TUpdateProviderOpts = {
  orgId: string
  id: string
  data: Partial<Provider>
  projectId?: string
}

export type TUpdateProviderResult = {
  provider?: Provider
  error?: Error
}

export const updateProvider = async (
  opts: TUpdateProviderOpts
): Promise<TUpdateProviderResult> => {
  const { orgId, id, data, projectId } = opts
  const resp = await providersApi.update(orgId, id, data, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update providers state with the updated provider
    const currentProviders = getProviders() || {}
    setProviders({ ...currentProviders, [resp.data.id]: resp.data })
  }

  return { provider: resp.data }
}
