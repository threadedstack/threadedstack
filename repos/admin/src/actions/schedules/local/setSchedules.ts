import type { Schedule } from '@tdsk/domain'
import { setSchedules as setSchedulesState } from '@TAF/state/accessors'

export const setSchedules = (schedules: Schedule[]) => {
  const map = Object.fromEntries(schedules.map((s) => [s.id, s])) as Record<
    string,
    Schedule
  >
  setSchedulesState(map)
}
