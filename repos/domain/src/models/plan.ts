import type { TPayPlanRaw, TPayPlanMeta } from '@TDM/types'
import { rawPlanToMeta } from '@TDM/utils/payments/rawPlanToMeta'

export type TPlanOpts = Omit<Plan, `metadata`> & {
  metadata: TPayPlanRaw | TPayPlanMeta
}

export class Plan {
  id: string
  name: string
  metadata: TPayPlanMeta

  constructor(opts: TPlanOpts) {
    Object.assign(this, {
      ...opts,
      metadata: rawPlanToMeta(opts.metadata),
    })
  }
}
