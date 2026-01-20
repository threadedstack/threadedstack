import type { TSubscriptionData } from '@TAF/types'
import { setSubscription as setSub } from '@TAF/state/accessors'

export const setSubscription = (sub: TSubscriptionData) => setSub(sub)
