import type { TPlanLimits, TBillingInterval } from '@TDM/types'

export class Plan {
  id: string
  name: string
  price: number
  limits: TPlanLimits
  seatPrice: number = 0
  currency: string = `usd`
  interval: TBillingInterval = `month`

  constructor(opts: Partial<Plan>) {
    Object.assign(this, opts)
  }
}
