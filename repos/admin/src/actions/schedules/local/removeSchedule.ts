import { getSchedules, setSchedules } from '@TAF/state/accessors'

export const removeSchedule = (id: string) => {
  const current = getSchedules() || {}
  const { [id]: _, ...rest } = current
  setSchedules(rest)
}
