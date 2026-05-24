import { schedulesApi } from '@TAF/services/schedulesApi'
import { getScheduleRuns, setScheduleRuns } from '@TAF/state/accessors'

export const fetchScheduleRuns = async (
  orgId: string | undefined,
  projectId: string | undefined,
  scheduleId: string
) => {
  if (!orgId || !projectId) return { error: new Error(`Missing orgId or projectId`) }

  const resp = await schedulesApi.listRuns(orgId, projectId, scheduleId)
  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const existing = getScheduleRuns() || {}
    setScheduleRuns({ ...existing, [scheduleId]: resp.data })
  }

  return resp
}
