import { Base } from '@TDM/models/base'
import { ESubscriptionTier, ESubscriptionStatus } from '@TDM/types'

export class Subscription extends Base {
  userId: string
  seats: number = 1
  stripePriceId?: string
  stripeCustomerId?: string
  currentPeriodEnd?: string
  currentPeriodStart?: string
  cancelAtPeriodEnd?: boolean
  stripeSubscriptionId?: string
  tier: string = ESubscriptionTier.free
  status: string = ESubscriptionStatus.active

  constructor(sub: Partial<Subscription>) {
    super()
    Object.assign(this, sub)
  }
}
