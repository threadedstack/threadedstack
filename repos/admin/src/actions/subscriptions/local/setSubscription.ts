import type { Subscription } from '@tdsk/domain'
import { setSubscription as setSub } from '@TAF/state/accessors'

export const setSubscription = (sub: Subscription) => setSub(sub)
