import type { TCollectionWithCount } from '@tdsk/domain'
import { collectionsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertCollection } from '@TAF/actions/collections/local/upsertCollection'

export const createCollection = async (
  orgId: string,
  projectId: string,
  data: Partial<TCollectionWithCount>
) => {
  const resp = await collectionsApi.create(orgId, projectId, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertCollection(projectId, resp.data)
  resp.data &&
    query.upsertListCache(collectionsApi.cache.list(orgId, projectId), resp.data)

  return resp
}
