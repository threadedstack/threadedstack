import { providersApi } from '@TAF/services'
import { removeProvider } from '@TAF/actions/providers/local/removeProvider'

export type TDeleteProviderOpts = {
  orgId: string
  id: string
}

export const deleteProvider = async (opts: TDeleteProviderOpts) => {
  const { orgId, id } = opts
  const resp = await providersApi.delete(orgId, id)

  if (resp.error) return { error: resp.error }
  removeProvider(id)
  return { success: resp.data }
}
