import { Base } from './base'

export class Subscription extends Base {
  userId: string
  tier: string
  status: string
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
