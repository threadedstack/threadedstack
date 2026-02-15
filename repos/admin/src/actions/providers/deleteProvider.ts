import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TDeleteProviderOpts = {
  orgId: string
  id: string
}

export type TDeleteProviderResult = {
  success?: boolean
  error?: Error
}

export const deleteProvider = async (
  opts: TDeleteProviderOpts
): Promise<TDeleteProviderResult> => {
  const { orgId, id } = opts
  const resp = await providersApi.delete(orgId, id)

  if (resp.error) {
    return { error: resp.error }
  }

  const currentProviders = getProviders() || {}
  const { [id]: removed, ...remainingProviders } = currentProviders
  setProviders(remainingProviders)

  return { success: true }
}
