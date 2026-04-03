import { threadsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeThread } from '@TAF/actions/threads/local/removeThread'

export const deleteThread = async (
  orgId: string,
  agentId: string,
  id: string,
  contextKey: string = 'org'
) => {
  const resp = await threadsApi.delete(orgId, agentId, id)
  if (resp.error) return { error: resp.error }

  removeThread(contextKey, id)
  query.removeFromListCache(threadsApi.cache.list(agentId), id)
  query.client.removeQueries({ queryKey: threadsApi.cache.detail(id) })

  return resp
}
