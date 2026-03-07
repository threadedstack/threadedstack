import { schedulesApi } from '@TAF/services'
import { setSchedules } from '@TAF/actions/schedules/local/setSchedules'

export const fetchSchedules = async (orgId: string) => {
  const resp = await schedulesApi.list(orgId)
  if (resp.error) return { error: resp.error }
  resp.data && setSchedules(resp.data)
  return resp
}
