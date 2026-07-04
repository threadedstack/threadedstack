import { taskProposalsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertTaskProposal } from '@TAF/actions/taskProposals/local/upsertTaskProposal'

export const reviewTaskProposal = async (
  orgId: string,
  id: string,
  data: { approve: boolean; reason?: string }
) => {
  const resp = await taskProposalsApi.review(orgId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertTaskProposal(resp.data)
  resp.data && query.upsertListCache(taskProposalsApi.cache.list(orgId), resp.data)
  resp.data && query.updateDetailCache(taskProposalsApi.cache.detail(id), resp.data)

  return resp
}
