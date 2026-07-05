import type { TVerifyProbe, TVerificationStatus } from '@TDM/types'

import { EVerificationStatus } from '@TDM/types'
import { DefaultVerifyProbe } from '@TDM/constants/verification'
import { Base } from '@TDM/models/base'

export class Verification extends Base {
  orgId!: string
  agentId!: string
  prNumber!: number
  prUrl: string | null = null
  mergeSha: string | null = null
  probe: TVerifyProbe = DefaultVerifyProbe
  status: TVerificationStatus = EVerificationStatus.pending
  detail: string | null = null
  revertPrUrl: string | null = null
  escalationId: string | null = null
  meta: Record<string, any> | null = null

  constructor(verification: Partial<Verification>) {
    super()
    Object.assign(this, verification)
  }
}
