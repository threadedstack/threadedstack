import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getTaskProposal } from '@TBE/endpoints/taskProposals/getTaskProposal'
import { listTaskProposals } from '@TBE/endpoints/taskProposals/listTaskProposals'
import { reviewTaskProposal } from '@TBE/endpoints/taskProposals/reviewTaskProposal'

/**
 * Task proposals scoped under an org: /:orgId/task-proposals
 * The human veto surface for self-sensed tasks (P4a). Authoring happens
 * server-side (runtime-brain sensing capture) and promotion is automatic
 * (work-cycle driven once a PR opens), so there is no create route and no
 * approve route here — only read and reject. Gated by the `sensing` feature flag.
 */
export const orgTaskProposals: TEndpointConfig = {
  path: `/:orgId/task-proposals`,
  method: EPMethod.Use,
  middleware: [featureGate(`sensing`)],
  endpoints: {
    listTaskProposals,
    getTaskProposal,
    reviewTaskProposal,
  },
}
