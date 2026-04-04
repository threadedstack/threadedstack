import type { TPlanLimits } from '@TDM/types'

export class Plan {
  id: string
  name: string
  price: number
  limits: TPlanLimits

  constructor(opts: Partial<Plan>) {
    Object.assign(this, opts)
  }
}
