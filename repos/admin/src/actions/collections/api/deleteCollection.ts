import { collectionsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeCollection } from '@TAF/actions/collections/local/removeCollection'

export const deleteCollection = async (
  orgId: string,
  projectId: string,
  name: string,
  id: string
) => {
  const resp = await collectionsApi.delete(orgId, projectId, name)
  if (resp.error) return { error: resp.error }
  removeCollection(projectId, id)
  query.removeFromListCache(collectionsApi.cache.list(orgId, projectId), id)
  query.client.removeQueries({ queryKey: collectionsApi.cache.detail(id) })

  return resp
}
