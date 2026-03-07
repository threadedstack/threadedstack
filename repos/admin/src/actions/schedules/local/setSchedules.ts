import type { Schedule } from '@tdsk/domain'
import { setSchedules as setSchedulesState } from '@TAF/state/accessors'

export const setSchedules = (schedules: Schedule[]) => {
  const map = schedules.reduce(
    (acc, schedule) => {
      acc[schedule.id] = schedule
      return acc
    },
    {} as Record<string, Schedule>
  )
  setSchedulesState(map)
}
