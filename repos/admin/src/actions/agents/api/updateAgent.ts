import type { TAgentPayload } from '@TAF/types/agent.types'

import { agentsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TUpdateAgentOpts = {
  orgId: string
  id: string
  projectId?: string
  data: TAgentPayload
}

export const updateAgent = async (opts: TUpdateAgentOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await agentsApi.update(orgId, id, data, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertAgent(contextKey, resp.data)
  resp.data && query.upsertListCache(agentsApi.cache.list(orgId, contextKey), resp.data)
  resp.data && query.updateDetailCache(agentsApi.cache.detail(id), resp.data)

  return resp
}
