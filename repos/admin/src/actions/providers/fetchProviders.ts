import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders } from '@TAF/state/accessors'

export type TFetchProvidersResult = {
  providers?: Record<string, Provider>
  error?: Error
}

export const fetchProviders = async (filters?: {
  orgId?: string
}): Promise<TFetchProvidersResult> => {
  const resp = await providersApi.list(filters)

  if (resp.error) {
    return { error: resp.error }
  }

  const providersMap =
    resp.data?.reduce((acc: Record<string, Provider>, provider: Provider) => {
      acc[provider.id] = provider
      return acc
    }, {}) || {}

  setProviders(providersMap)
  return { providers: providersMap }
}
