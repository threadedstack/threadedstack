import type { TScanResult, TAuditVerdict, TSkillProposalStatus } from '@TDM/types'

import { ESkillProposalStatus } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class SkillProposal extends Base {
  orgId!: string
  agentId!: string
  name!: string
  description!: string
  instructions!: string
  tools: string[] = []
  triggerKeywords: string[] = []
  alwaysActive: boolean = false
  status: TSkillProposalStatus = ESkillProposalStatus.pending
  scanResult: TScanResult | null = null
  auditVerdict: TAuditVerdict | null = null
  promotedSkillId: string | null = null
  reason: string | null = null
  meta: Record<string, any> | null = null

  constructor(proposal: Partial<SkillProposal>) {
    super()
    Object.assign(this, proposal)
  }
}
