import { skillProposalsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertSkillProposal } from '@TAF/actions/skillProposals/local/upsertSkillProposal'

export const reviewSkillProposal = async (
  orgId: string,
  id: string,
  data: { approve: boolean; reason?: string }
) => {
  const resp = await skillProposalsApi.review(orgId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertSkillProposal(resp.data)
  resp.data && query.upsertListCache(skillProposalsApi.cache.list(orgId), resp.data)
  resp.data && query.updateDetailCache(skillProposalsApi.cache.detail(id), resp.data)

  return resp
}
