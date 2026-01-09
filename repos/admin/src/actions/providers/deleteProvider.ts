import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TDeleteProviderResult = {
  success?: boolean
  error?: Error
}

export const deleteProvider = async (id: string): Promise<TDeleteProviderResult> => {
  const resp = await providersApi.delete(id)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove provider from state
  const currentProviders = getProviders() || {}
  const { [id]: removed, ...remainingProviders } = currentProviders
  setProviders(remainingProviders)

  return { success: true }
}
