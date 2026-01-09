import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TUpdateProviderInput = {
  name?: string
  type?: string
  config?: Record<string, any>
  description?: string
}

export type TUpdateProviderResult = {
  provider?: Provider
  error?: Error
}

export const updateProvider = async (
  id: string,
  input: TUpdateProviderInput
): Promise<TUpdateProviderResult> => {
  const resp = await providersApi.update(id, input)

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
