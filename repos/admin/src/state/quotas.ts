import type { TQuotaData, TLimitsData } from '@TAF/types'
import { atomWithReset } from 'jotai/utils'

/**
 * Organization quota usage state
 */
export const orgQuotaState = atomWithReset<TQuotaData | undefined>(undefined)

/**
 * Organization quota limits state (from plan)
 */
export const orgLimitsState = atomWithReset<TLimitsData | undefined>(undefined)
