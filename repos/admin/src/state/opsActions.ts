import type { TOpsActionRow } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const opsActionsState = atomWithReset<Record<string, TOpsActionRow>>(undefined)
export const activeOpsActionIdState = atomWithReset<string>(undefined)
