import { escalationsApi } from '@TAF/services'
import { setEscalations } from '@TAF/actions/escalations/local/setEscalations'

export type TFetchEscalations = {
  orgId: string
  status?: string
  agentId?: string
}

export const fetchEscalations = async ({ orgId, status, agentId }: TFetchEscalations) => {
  const query: Record<string, any> = {}
  if (status) query.status = status
  if (agentId) query.agentId = agentId

  const resp = await escalationsApi.list(orgId, query)
  if (resp.error) return { error: resp.error }
  resp.data && setEscalations(resp.data)

  return resp
}
