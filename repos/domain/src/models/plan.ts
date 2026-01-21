import type { TPayPlanRaw, TPayPlanMeta } from '@TDM/types'
import { rawPlanToMeta } from '@TDM/utils/payments/rawPlanToMeta'

export type TPlanOpts = Omit<Plan, `metadata`> & {
  metadata: TPayPlanRaw | TPayPlanMeta
}

type TRecurring = {
  count?: number
  active?: boolean
  interval?: string
}

export class Plan {
  id: string
  name: string
  description?: string
  recurring?: TRecurring
  metadata: TPayPlanMeta

  constructor(opts: TPlanOpts) {
    Object.assign(this, {
      ...opts,
      recurring: { ...opts?.recurring },
      metadata: rawPlanToMeta(opts.metadata),
    })
  }
}
