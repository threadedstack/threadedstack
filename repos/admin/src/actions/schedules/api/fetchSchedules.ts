import { schedulesApi } from '@TAF/services'
import { setSchedules } from '@TAF/actions/schedules/local/setSchedules'

type TFetchSchedulesOpts = {
  orgId: string
  projectId: string
}

export const fetchSchedules = async (opts: TFetchSchedulesOpts) => {
  const { orgId, projectId } = opts
  const resp = await schedulesApi.list(orgId, projectId)
  if (resp.error) return { error: resp.error }
  resp.data && setSchedules(projectId, resp.data)
  return resp
}
