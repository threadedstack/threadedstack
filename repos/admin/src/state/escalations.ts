import type { TEscalation } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const escalationsState = atomWithReset<Record<string, TEscalation>>(undefined)
export const activeEscalationIdState = atomWithReset<string>(undefined)
