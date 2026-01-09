import type { Provider } from '@tdsk/domain'

import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TCreateProviderInput = {
  name: string
  type: string
  teamId: string
  config?: Record<string, any>
  description?: string
}

export type TCreateProviderResult = {
  provider?: Provider
  error?: Error
}

export const createProvider = async (
  input: TCreateProviderInput
): Promise<TCreateProviderResult> => {
  const resp = await providersApi.create(input)

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
