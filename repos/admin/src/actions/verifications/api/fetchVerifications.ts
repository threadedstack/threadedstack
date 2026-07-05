import { verificationsApi } from '@TAF/services'
import { setVerifications } from '@TAF/actions/verifications/local/setVerifications'

export type TFetchVerifications = {
  orgId: string
  status?: string
  agentId?: string
}

export const fetchVerifications = async ({
  orgId,
  status,
  agentId,
}: TFetchVerifications) => {
  const query: Record<string, any> = {}
  if (status) query.status = status
  if (agentId) query.agentId = agentId

  const resp = await verificationsApi.list(orgId, query)
  if (resp.error) return { error: resp.error }
  resp.data && setVerifications(resp.data)

  return resp
}
