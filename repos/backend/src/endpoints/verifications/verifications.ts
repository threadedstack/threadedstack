import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getVerification } from '@TBE/endpoints/verifications/getVerification'
import { listVerifications } from '@TBE/endpoints/verifications/listVerifications'

/**
 * Verifications scoped under an org: /:orgId/verifications
 * Read-only observability surface for post-merge safety checks (P4c).
 * After a steward PR merges + deploys, a verify cycle checks the declared
 * success probe against prod. On regression it automatically opens a revert PR
 * and files a target:app escalation — no human action required here.
 * This surface is purely informational. Gated by the `verification` feature flag.
 */
export const orgVerifications: TEndpointConfig = {
  path: `/:orgId/verifications`,
  method: EPMethod.Use,
  middleware: [featureGate(`verification`)],
  endpoints: {
    listVerifications,
    getVerification,
  },
}
