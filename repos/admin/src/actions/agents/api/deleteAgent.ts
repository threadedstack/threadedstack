import { agentsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeAgent } from '@TAF/actions/agents/local/removeAgent'

export type TDeleteAgentOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const deleteAgent = async (opts: TDeleteAgentOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await agentsApi.delete(orgId, id, projectId)

  if (resp.error) return { error: resp.error }
  const contextKey = projectId || 'org'
  removeAgent(contextKey, id)
  query.removeFromListCache(agentsApi.cache.list(orgId, contextKey), id)
  query.client.removeQueries({ queryKey: agentsApi.cache.detail(id) })

  return resp
}
