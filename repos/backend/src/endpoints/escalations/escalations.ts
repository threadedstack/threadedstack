import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getEscalation } from '@TBE/endpoints/escalations/getEscalation'
import { listEscalations } from '@TBE/endpoints/escalations/listEscalations'
import { resolveEscalation } from '@TBE/endpoints/escalations/resolveEscalation'

/**
 * Escalations scoped under an org: /:orgId/escalations
 * The human async-override surface for agent escalations (P4b). The steward opens
 * escalations automatically during its sensing/work cycles; this surface lets a
 * human or admin mark them resolved or rejected out-of-band. Nothing in the
 * steward loop waits on a response — this is advisory only. Gated by the
 * `escalation` feature flag.
 */
export const orgEscalations: TEndpointConfig = {
  path: `/:orgId/escalations`,
  method: EPMethod.Use,
  middleware: [featureGate(`escalation`)],
  endpoints: {
    listEscalations,
    getEscalation,
    resolveEscalation,
  },
}
