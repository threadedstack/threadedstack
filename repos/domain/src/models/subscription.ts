import { Base } from './base'

export class Subscription extends Base {
  tier: string
  status: string
  userId: string
  polarId?: string
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
