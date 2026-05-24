import { getContextSchedules, setContextSchedules } from '@TAF/state/accessors'

export const removeSchedule = (projectId: string, id: string) => {
  const current = getContextSchedules(projectId) || {}
  const { [id]: _, ...rest } = current
  setContextSchedules(projectId, rest)
}
