import { opsActionsApi } from '@TAF/services'
import { setOpsActions } from '@TAF/actions/opsActions/local/setOpsActions'

export type TFetchOpsActions = {
  orgId: string
  status?: string
  agentId?: string
}

export const fetchOpsActions = async ({ orgId, status, agentId }: TFetchOpsActions) => {
  const query: Record<string, any> = {}
  if (status) query.status = status
  if (agentId) query.agentId = agentId

  const resp = await opsActionsApi.list(orgId, query)
  if (resp.error) return { error: resp.error }
  resp.data && setOpsActions(resp.data)

  return resp
}
