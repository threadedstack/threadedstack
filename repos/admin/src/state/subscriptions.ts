import type { TSubscriptionData, TPlanData } from '@TAF/types'
import { atomWithReset } from 'jotai/utils'

/**
 * Current user subscription state
 */
export const currentSubscriptionState = atomWithReset<TSubscriptionData | null>(null)

/**
 * Available payment plans state
 */
export const paymentPlansState = atomWithReset<TPlanData[]>([])
