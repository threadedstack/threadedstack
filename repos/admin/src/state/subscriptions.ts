import type { Plan, Subscription } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const paymentPlansState = atomWithReset<Plan[] | undefined>(undefined)
export const subscriptionState = atomWithReset<Subscription | null>(null)
