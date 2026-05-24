import type { Schedule, ScheduleRun } from '@tdsk/domain'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId -> scheduleId -> Schedule
export const schedulesState =
  atomWithReset<Record<string, Record<string, Schedule>>>(undefined)

// Derived: project-level schedules
export const projectSchedulesState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(schedulesState)?.[projectId] : undefined
})

export const activeScheduleIdState = atomWithReset<string>(undefined)
export const scheduleRunsState = atomWithReset<Record<string, ScheduleRun[]> | undefined>(
  undefined
)
