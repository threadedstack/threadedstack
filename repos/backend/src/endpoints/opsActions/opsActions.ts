import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getOpsAction } from '@TBE/endpoints/opsActions/getOpsAction'
import { listOpsActions } from '@TBE/endpoints/opsActions/listOpsActions'
import { overrideOpsAction } from '@TBE/endpoints/opsActions/overrideOpsAction'

/**
 * Ops actions scoped under an org: /:orgId/ops-actions
 * Observability and OPTIONAL async human override for the ops-actions pipeline (P4d).
 * The adversary ops-review cycle (D11) is the DEFAULT gate; this surface is a human
 * safety net only — nothing in the steward loop waits on it.
 * Gated by the `ops` feature flag (ships DISABLED).
 */
export const orgOpsActions: TEndpointConfig = {
  path: `/:orgId/ops-actions`,
  method: EPMethod.Use,
  middleware: [featureGate(`ops`)],
  endpoints: {
    listOpsActions,
    getOpsAction,
    overrideOpsAction,
  },
}
