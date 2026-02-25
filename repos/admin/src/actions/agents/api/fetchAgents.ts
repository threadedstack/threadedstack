import { agentsApi } from '@TAF/services'
import { setAgents } from '@TAF/actions/agents/local/setAgents'

export type TFetchAgentsOpts = {
  orgId: string
  projectId?: string
}

export const fetchAgents = async (opts: TFetchAgentsOpts) => {
  const { orgId, projectId } = opts
  const resp = await agentsApi.list(orgId, projectId)
  if (resp.error) return { error: resp.error }

  const contextKey = projectId || 'org'
  resp.data && setAgents(contextKey, resp.data)

  return resp
}
