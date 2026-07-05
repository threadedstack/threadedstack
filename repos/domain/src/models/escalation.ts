import type { TEscalationTarget, TEscalationStatus } from '@TDM/types'

import { EEscalationStatus } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class Escalation extends Base {
  orgId!: string
  agentId!: string
  title!: string
  problem!: string
  evidence: string[] = []
  proposedPatch: string | null = null
  target!: TEscalationTarget
  status: TEscalationStatus = EEscalationStatus.open
  dedupeKey!: string
  issueRef: string | null = null
  resolvedRef: string | null = null
  reason: string | null = null
  meta: Record<string, any> | null = null

  constructor(escalation: Partial<Escalation>) {
    super()
    Object.assign(this, escalation)
  }
}
