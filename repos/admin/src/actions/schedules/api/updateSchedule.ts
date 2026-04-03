import type { Schedule } from '@tdsk/domain'
import { schedulesApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertSchedule } from '@TAF/actions/schedules/local/upsertSchedule'

export const updateSchedule = async (
  orgId: string,
  id: string,
  data: Partial<Schedule>
) => {
  const resp = await schedulesApi.update(orgId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertSchedule(resp.data)
  resp.data && query.upsertListCache(schedulesApi.cache.list(orgId), resp.data)
  resp.data && query.updateDetailCache(schedulesApi.cache.detail(id), resp.data)
  return resp
}
