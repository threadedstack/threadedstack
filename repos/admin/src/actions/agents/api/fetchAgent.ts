import { agentsApi } from '@TAF/services'
import { upsertAgent } from '@TAF/actions/agents/local/upsertAgent'

export type TFetchAgentOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const fetchAgent = async (opts: TFetchAgentOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await agentsApi.get(orgId, id, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && upsertAgent(contextKey, resp.data)

  return resp
}
