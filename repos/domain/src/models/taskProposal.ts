import type {
  TScanResult,
  TAuditVerdict,
  TTaskPriority,
  TTaskSourceSignal,
  TTaskProposalStatus,
} from '@TDM/types'

import { ETaskProposalStatus } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class TaskProposal extends Base {
  orgId!: string
  agentId!: string
  title!: string
  description!: string
  priority!: TTaskPriority
  evidence!: string
  sourceSignal!: TTaskSourceSignal
  dedupeKey!: string
  repos: string[] = []
  status: TTaskProposalStatus = ETaskProposalStatus.pending
  scanResult: TScanResult | null = null
  auditVerdict: TAuditVerdict | null = null
  prUrl: string | null = null
  reason: string | null = null
  parentId: string | null = null
  initiative: string | null = null
  meta: Record<string, any> | null = null

  constructor(proposal: Partial<TaskProposal>) {
    super()
    Object.assign(this, proposal)
  }
}
