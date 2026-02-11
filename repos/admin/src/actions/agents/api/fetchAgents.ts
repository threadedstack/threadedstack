import { agentsApi } from '@TAF/services'
import { upsertAgents } from '@TAF/actions/agents/local/upsertAgents'

export type TFetchAgentsOpts = {
  orgId: string
  projectId?: string
}

export const fetchAgents = async (opts: TFetchAgentsOpts) => {
  const { orgId, projectId } = opts
  const resp = await agentsApi.list(orgId, projectId)
  if (resp.error) return { error: resp.error }

  upsertAgents(resp.data)

  return resp
}
