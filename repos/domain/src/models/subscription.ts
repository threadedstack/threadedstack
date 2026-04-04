import { ESubscriptionTier, ESubscriptionStatus } from '../types/payments.types'
import { Base } from './base'

export class Subscription extends Base {
  tier: string = ESubscriptionTier.free
  status: string = ESubscriptionStatus.active
  userId: string
  seats: number = 1
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  currentPeriodEnd?: string
  currentPeriodStart?: string
  cancelAtPeriodEnd?: boolean

  constructor(sub: Partial<Subscription>) {
    super()
    Object.assign(this, sub)
  }
}
