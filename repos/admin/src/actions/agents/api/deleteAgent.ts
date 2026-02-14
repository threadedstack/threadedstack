import { agentsApi } from '@TAF/services'
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
  removeAgent(id)

  return resp
}
