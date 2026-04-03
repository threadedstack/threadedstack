import { assetsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeAsset } from '@TAF/actions/assets/local/removeAsset'

export const deleteAsset = async (contextKey: string, id: string) => {
  const resp = await assetsApi.delete(id)
  if (resp.error) return { error: resp.error }
  if (resp.data?.success) {
    removeAsset(contextKey, id)
    query.removeFromListCache(assetsApi.cache.list(), id)
    query.client.removeQueries({ queryKey: assetsApi.cache.detail(id) })
  }

  return resp
}
