import { opsActionsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertOpsAction } from '@TAF/actions/opsActions/local/upsertOpsAction'

export const overrideOpsAction = async (
  orgId: string,
  id: string,
  data: { approve: boolean; reason?: string }
) => {
  const resp = await opsActionsApi.override(orgId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertOpsAction(resp.data)
  resp.data && query.upsertListCache(opsActionsApi.cache.list(orgId), resp.data)
  resp.data && query.updateDetailCache(opsActionsApi.cache.detail(id), resp.data)

  return resp
}
