import { skillProposalsApi } from '@TAF/services'
import { setSkillProposals } from '@TAF/actions/skillProposals/local/setSkillProposals'

export type TFetchSkillProposals = {
  orgId: string
  status?: string
  agentId?: string
}

export const fetchSkillProposals = async ({
  orgId,
  status,
  agentId,
}: TFetchSkillProposals) => {
  const query: Record<string, any> = {}
  if (status) query.status = status
  if (agentId) query.agentId = agentId

  const resp = await skillProposalsApi.list(orgId, query)
  if (resp.error) return { error: resp.error }
  resp.data && setSkillProposals(resp.data)

  return resp
}
