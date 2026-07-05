import type {
  TOpsActionStatus,
  TOpsActionResult,
  TOpsScanResult,
  TOpsRollback,
  TOpsActionInput,
} from '@TDM/types'

import type { EOpsAction } from '@TDM/constants/ops'
import { EOpsActionStatus } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class OpsAction extends Base {
  orgId!: string
  agentId!: string
  action!: EOpsAction
  params!: TOpsActionInput['params']
  dryRun: boolean = true
  dryRunResult: TOpsActionResult | null = null
  result: TOpsActionResult | null = null
  status: TOpsActionStatus = EOpsActionStatus.proposed
  scanResult: TOpsScanResult | null = null
  reviewVerdict: { approved: boolean; reason: string; by?: string } | null = null
  rollback: TOpsRollback | null = null
  reason: string | null = null
  meta: Record<string, any> | null = null

  constructor(opsAction: Partial<OpsAction>) {
    super()
    Object.assign(this, opsAction)
  }
}
