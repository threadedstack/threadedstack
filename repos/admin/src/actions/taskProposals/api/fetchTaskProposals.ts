import { taskProposalsApi } from '@TAF/services'
import { setTaskProposals } from '@TAF/actions/taskProposals/local/setTaskProposals'

export type TFetchTaskProposals = {
  orgId: string
  status?: string
  agentId?: string
}

export const fetchTaskProposals = async ({
  orgId,
  status,
  agentId,
}: TFetchTaskProposals) => {
  const query: Record<string, any> = {}
  if (status) query.status = status
  if (agentId) query.agentId = agentId

  const resp = await taskProposalsApi.list(orgId, query)
  if (resp.error) return { error: resp.error }
  resp.data && setTaskProposals(resp.data)

  return resp
}
