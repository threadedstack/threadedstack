import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders } from '@TAF/state/accessors'

export type TFetchProvidersOpts = {
  orgId: string
}

export type TFetchProvidersResult = {
  providers?: Record<string, Provider>
  error?: Error
}

export const fetchProviders = async (
  opts: TFetchProvidersOpts
): Promise<TFetchProvidersResult> => {
  const { orgId } = opts
  const resp = await providersApi.list(orgId)

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
