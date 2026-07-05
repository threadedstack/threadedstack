import { escalationsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertEscalation } from '@TAF/actions/escalations/local/upsertEscalation'

export const resolveEscalation = async (
  orgId: string,
  id: string,
  data: { status: 'resolved' | 'rejected'; resolvedRef?: string; reason?: string }
) => {
  const resp = await escalationsApi.resolve(orgId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertEscalation(resp.data)
  resp.data && query.upsertListCache(escalationsApi.cache.list(orgId), resp.data)
  resp.data && query.updateDetailCache(escalationsApi.cache.detail(id), resp.data)

  return resp
}
