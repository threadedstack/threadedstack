import type { Schedule, ScheduleRun } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const schedulesState = atomWithReset<Record<string, Schedule>>(undefined)
export const activeScheduleIdState = atomWithReset<string>(undefined)
export const scheduleRunsState = atomWithReset<Record<string, ScheduleRun[]> | undefined>(
  undefined
)
