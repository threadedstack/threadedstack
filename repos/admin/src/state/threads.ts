import type { Thread } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const threadsState = atomWithReset<Record<string, Thread>>(undefined)
export const activeThreadIdState = atomWithReset<string>(undefined)
