import type { Plan } from '@tdsk/domain'
import type { TSubscriptionData } from '@TAF/types'
import { atomWithReset } from 'jotai/utils'

export const paymentPlansState = atomWithReset<Plan[]>(undefined)
export const subscriptionState = atomWithReset<TSubscriptionData | null>(null)
