import { providersApi } from '@TAF/services'
import { setProviders, getProviders } from '@TAF/state/accessors'

export type TDeleteProviderOpts = {
  orgId: string
  id: string
  projectId?: string
}

export type TDeleteProviderResult = {
  success?: boolean
  error?: Error
}

export const deleteProvider = async (
  opts: TDeleteProviderOpts
): Promise<TDeleteProviderResult> => {
  const { orgId, id, projectId } = opts
  const resp = await providersApi.delete(orgId, id, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove provider from state
  const currentProviders = getProviders() || {}
  const { [id]: removed, ...remainingProviders } = currentProviders
  setProviders(remainingProviders)

  return { success: true }
}
