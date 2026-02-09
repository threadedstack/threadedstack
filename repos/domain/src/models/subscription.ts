import { ESubscriptionTier, ESubscriptionStatus } from '../types/payments.types'
import { Base } from './base'

export class Subscription extends Base {
  tier: string = ESubscriptionTier.free
  status: string = ESubscriptionStatus.active
  userId: string
  polarId?: string
  seats: number = 0
  polarPriceId?: string
  polarCustomerId?: string
  currentPeriodEnd?: string
  currentPeriodStart?: string
  cancelAtPeriodEnd?: boolean

  constructor(sub: Partial<Subscription>) {
    super()
    Object.assign(this, sub)
  }
}
