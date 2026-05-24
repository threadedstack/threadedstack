import type { Schedule } from '@tdsk/domain'
import { getContextSchedules, setContextSchedules } from '@TAF/state/accessors'

export const upsertSchedule = (projectId: string, schedule: Schedule) => {
  const current = getContextSchedules(projectId) || {}
  setContextSchedules(projectId, { ...current, [schedule.id]: schedule })
}
