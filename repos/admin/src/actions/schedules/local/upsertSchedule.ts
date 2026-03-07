import type { Schedule } from '@tdsk/domain'
import { getSchedules, setSchedules } from '@TAF/state/accessors'

export const upsertSchedule = (schedule: Schedule) => {
  const current = getSchedules() || {}
  setSchedules({ ...current, [schedule.id]: schedule })
}
