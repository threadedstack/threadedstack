import type { Schedule } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const schedulesState = atomWithReset<Record<string, Schedule>>(undefined)
export const activeScheduleIdState = atomWithReset<string>(undefined)
