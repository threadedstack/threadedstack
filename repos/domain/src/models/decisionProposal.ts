import type { TDecisionAxis, TDecisionStatus } from '@TDM/types'

import { EDecisionStatus } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class DecisionProposal extends Base {
  orgId!: string
  openedByAgentId!: string
  title!: string
  axis!: TDecisionAxis
  description!: string
  evidence: string[] = []
  status: TDecisionStatus = EDecisionStatus.open
  round = 1
  resolution: string | null = null
  resolvedRef: string | null = null

  constructor(proposal: Partial<DecisionProposal>) {
    super()
    Object.assign(this, proposal)
  }
}
