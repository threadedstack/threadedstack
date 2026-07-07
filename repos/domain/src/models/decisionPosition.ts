import type { TStance } from '@TDM/types'

import { Base } from '@TDM/models/base'

export class DecisionPosition extends Base {
  orgId!: string
  proposalId!: string
  agentId!: string
  stance!: TStance
  reasoning!: string
  round!: number

  constructor(position: Partial<DecisionPosition>) {
    super()
    Object.assign(this, position)
  }
}
