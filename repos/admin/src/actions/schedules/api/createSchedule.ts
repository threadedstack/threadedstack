import type { Schedule } from '@tdsk/domain'
import { schedulesApi } from '@TAF/services'
import { upsertSchedule } from '@TAF/actions/schedules/local/upsertSchedule'

export const createSchedule = async (orgId: string, data: Partial<Schedule>) => {
  const resp = await schedulesApi.create(orgId, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertSchedule(resp.data)
  return resp
}
