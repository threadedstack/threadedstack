import { schedulesApi } from '@TAF/services'
import { removeSchedule } from '@TAF/actions/schedules/local/removeSchedule'

export const deleteSchedule = async (orgId: string, id: string) => {
  const resp = await schedulesApi.delete(orgId, id)
  if (resp.error) return { error: resp.error }
  removeSchedule(id)
  return resp
}
