import type { Schedule } from '@tdsk/domain'
import { setContextSchedules } from '@TAF/state/accessors'

export const setSchedules = (projectId: string, schedules: Schedule[]) => {
  const map = Object.fromEntries(schedules.map((s) => [s.id, s])) as Record<
    string,
    Schedule
  >
  setContextSchedules(projectId, map)
}
