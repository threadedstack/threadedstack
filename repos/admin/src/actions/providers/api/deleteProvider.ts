import { providersApi } from '@TAF/services'
import { query } from '@TAF/services/query'
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
  query.removeFromListCache(providersApi.cache.list(orgId), id)
  query.client.removeQueries({ queryKey: providersApi.cache.detail(id) })

  return { success: resp.data }
}
